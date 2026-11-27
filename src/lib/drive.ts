import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, settings } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * Google Drive con la cuenta del admin y el permiso mínimo `drive.file` (RNF-09).
 * Todo lo que el sistema crea queda dentro de la carpeta raíz elegida con el Picker (RF-22).
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class DriveError extends Error {}
/** RF-30 */
export class DriveDisconnectedError extends DriveError {
  constructor() {
    super("Drive desconectado, vuelve a conectarlo en Configuración.");
  }
}
export class DriveNotConfiguredError extends DriveError {
  constructor() {
    super("Drive no está conectado todavía. El admin debe conectarlo en Configuración.");
  }
}

export async function getSettings() {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
}

export type DriveState = "sin_conectar" | "sin_carpeta" | "conectado" | "desconectado";

export function driveState(s: Awaited<ReturnType<typeof getSettings>>): DriveState {
  if (!s.driveRefreshTokenEnc) return "sin_conectar";
  if (s.driveDisconnectedAt) return "desconectado";
  if (!s.driveRootFolderId) return "sin_carpeta";
  return "conectado";
}

/* ---------- OAuth ---------- */

let cachedToken: { value: string; expires: number } | null = null;

export function forgetAccessToken() {
  cachedToken = null;
}

async function markDisconnected() {
  cachedToken = null;
  await db.update(settings).set({ driveDisconnectedAt: new Date() }).where(eq(settings.id, 1));
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new DriveError("Google no aceptó la conexión. Inténtalo otra vez.");
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string; scope: string };
}

/** Access token de corta duración a partir del refresh token cifrado. */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const s = await getSettings();
  if (!s.driveRefreshTokenEnc) throw new DriveNotConfiguredError();
  if (s.driveDisconnectedAt) throw new DriveDisconnectedError();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: decrypt(s.driveRefreshTokenEnc),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_grant" || res.status === 400 || res.status === 401) {
      await markDisconnected();
      throw new DriveDisconnectedError();
    }
    throw new DriveError("No se pudo hablar con Google Drive. Inténtalo en unos minutos.");
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/* ---------- Llamadas a la API ---------- */

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await markDisconnected();
    throw new DriveDisconnectedError();
  }
  return res;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Drive: ${what} falló`, res.status, text);
    throw new DriveError(`Drive no pudo ${what}.`);
  }
  return (await res.json()) as T;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  trashed?: boolean;
  createdTime?: string;
};

const FILE_FIELDS = "id,name,mimeType,size,webViewLink,parents,trashed,createdTime";

export async function getFile(id: string): Promise<DriveFile | null> {
  const res = await driveFetch(`${API}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}&supportsAllDrives=true`);
  if (res.status === 404) return null;
  return json<DriveFile>(res, "leer el archivo");
}

/** RF-31: la carpeta existe y no está en la papelera. */
export async function folderExists(id: string | null | undefined) {
  if (!id) return false;
  const f = await getFile(id);
  return !!f && !f.trashed;
}

export async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await driveFetch(`${API}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return (await json<{ id: string }>(res, "crear la carpeta")).id;
}

export async function listChildren(parentId: string, extraQuery = ""): Promise<DriveFile[]> {
  const q = `'${parentId}' in parents and trashed = false${extraQuery ? ` and ${extraQuery}` : ""}`;
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FILE_FIELDS})`, pageSize: "200", orderBy: "createdTime" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${API}/files?${params}`);
    const page = await json<{ files: DriveFile[]; nextPageToken?: string }>(res, "listar la carpeta");
    out.push(...page.files);
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function trashFile(id: string) {
  const res = await driveFetch(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (res.status !== 404) await json(res, "mover el archivo a la papelera");
}

export async function deleteFile(id: string) {
  const res = await driveFetch(`${API}/files/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new DriveError("Drive no pudo borrar el archivo.");
}

/**
 * RNF-08: el servidor solo abre la sesión de subida reanudable; el navegador
 * envía el archivo directo a Google (Vercel no acepta más de 4.5 MB).
 */
export async function startResumableUpload(opts: { name: string; mimeType: string; size: number; parentId: string; origin: string }) {
  const res = await driveFetch(`${UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(opts.size),
      // Necesario para que Google acepte la subida desde el navegador (CORS).
      Origin: opts.origin,
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.parentId] }),
  });
  if (!res.ok) await json(res, "preparar la subida");
  const location = res.headers.get("location");
  if (!location) throw new DriveError("Drive no devolvió la dirección de subida.");
  return location;
}

/** Sube un .xlsx y pide convertirlo a Google Sheets. Con `fileId` reemplaza el contenido de uno existente. */
export async function uploadSpreadsheet(opts: { name: string; parentId?: string; data: Buffer; fileId?: string }): Promise<DriveFile> {
  const boundary = `gp${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = opts.fileId ? { name: opts.name } : { name: opts.name, mimeType: SHEET_MIME, parents: [opts.parentId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`),
    opts.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const url = opts.fileId
    ? `${UPLOAD}/files/${encodeURIComponent(opts.fileId)}?uploadType=multipart&fields=${FILE_FIELDS}`
    : `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`;
  const res = await driveFetch(url, {
    method: opts.fileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(body),
  });
  return json<DriveFile>(res, "guardar la planilla");
}

/** Lee una hoja de Google Sheets como .xlsx (RF-28, RF-34). */
export async function exportSheetAsXlsx(fileId: string): Promise<Buffer> {
  const meta = await getFile(fileId);
  if (!meta) throw new DriveError("No se encontró la planilla en Drive, o la app no tiene permiso para leerla.");
  const url =
    meta.mimeType === SHEET_MIME
      ? `${API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
      : `${API}/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await driveFetch(url);
  if (!res.ok) throw new DriveError("Drive no pudo leer la planilla.");
  return Buffer.from(await res.arrayBuffer());
}

/* ---------- Carpetas de cada trabajo (RF-23, RF-40, RF-43) ---------- */

function folderName(code: string, client: string, description: string) {
  const short = description.replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return `${code} - ${client} - ${short}`.replace(/[\\/:*?"<>|]/g, "-");
}

type JobForFolder = {
  id: string;
  code: string;
  description: string;
  parentJobId: string | null;
  client: { name: string };
};

/** Crea la carpeta del trabajo con Recibido, Avances y Entrega final, y guarda sus IDs. */
export async function createJobFolders(job: JobForFolder) {
  const s = await getSettings();
  if (driveState(s) === "sin_conectar" || driveState(s) === "sin_carpeta") throw new DriveNotConfiguredError();
  let parentId = s.driveRootFolderId!;
  // RF-40: el relacionado va dentro de la carpeta del original.
  if (job.parentJobId) {
    const parent = await db.query.jobs.findFirst({ where: eq(jobs.id, job.parentJobId), columns: { driveFolderId: true } });
    if (parent?.driveFolderId && (await folderExists(parent.driveFolderId))) parentId = parent.driveFolderId;
  }
  const folderId = await createFolder(folderName(job.code, job.client.name, job.description), parentId);
  const [recibido, avances, entregaFinal] = await Promise.all([
    createFolder("Recibido", folderId),
    createFolder("Avances", folderId),
    createFolder("Entrega final", folderId),
  ]);
  await db
    .update(jobs)
    .set({ driveFolderId: folderId, driveRecibidoId: recibido, driveAvancesId: avances, driveEntregaFinalId: entregaFinal, drivePagosId: null })
    .where(eq(jobs.id, job.id));
  return { folderId, recibido, avances, entregaFinal };
}

/** RF-43: la subcarpeta "Pagos" se crea al subir la primera captura. */
export async function ensurePagosFolder(jobId: string) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId), columns: { driveFolderId: true, drivePagosId: true } });
  if (!job?.driveFolderId) throw new DriveError("El trabajo no tiene carpeta en Drive. Créala desde su ficha.");
  if (job.drivePagosId && (await folderExists(job.drivePagosId))) return job.drivePagosId;
  const id = await createFolder("Pagos", job.driveFolderId);
  await db.update(jobs).set({ drivePagosId: id }).where(eq(jobs.id, jobId));
  return id;
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/** Carpeta "Respaldos" dentro de la raíz (RF-32). */
export async function ensureBackupsFolder() {
  const s = await getSettings();
  if (!s.driveRootFolderId) throw new DriveNotConfiguredError();
  if (s.driveBackupsFolderId && (await folderExists(s.driveBackupsFolderId))) return s.driveBackupsFolderId;
  const id = await createFolder("Respaldos", s.driveRootFolderId);
  await db.update(settings).set({ driveBackupsFolderId: id }).where(eq(settings.id, 1));
  return id;
}

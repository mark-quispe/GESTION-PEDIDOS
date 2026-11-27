import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, batch } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { DRIVE_SCOPE, exchangeCode, forgetAccessToken } from "@/lib/drive";
import { getSettings } from "@/lib/settings";

const back = (request: NextRequest, status: string) => NextResponse.redirect(new URL(`/configuracion?drive=${status}`, request.url));

function emailFromIdToken(idToken?: string) {
  try {
    return (JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8")) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

/** RF-22: vuelta de Google. Guarda la llave cifrada (AES-256-GCM). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.redirect(new URL("/", request.url));
  const jar = await cookies();
  const expected = jar.get("drive_oauth_state")?.value;
  jar.delete({ name: "drive_oauth_state", path: "/api/drive" });
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back(request, "cancelado");
  if (!expected || sp.get("state") !== expected) return back(request, "error");
  try {
    const token = await exchangeCode(sp.get("code") ?? "", new URL("/api/drive/callback", request.nextUrl.origin).toString());
    if (!token.scope.includes(DRIVE_SCOPE)) return back(request, "sin-permiso");
    if (!token.refresh_token) return back(request, "sin-llave");
    const email = emailFromIdToken(token.id_token);
    const before = await getSettings();
    // RF-26: con otra cuenta hay que volver a elegir la carpeta.
    const same = before.driveAccountEmail && before.driveAccountEmail === email;
    await batch([
      db
        .update(settings)
        .set({
          driveRefreshTokenEnc: encrypt(token.refresh_token),
          driveAccountEmail: email,
          driveConnectedAt: new Date(),
          driveDisconnectedAt: null,
          ...(same ? {} : { driveRootFolderId: null, driveRootFolderName: null, driveBackupsFolderId: null, driveContingencyFileId: null }),
        })
        .where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "conectar", summary: `conectó Drive con ${email ?? "una cuenta de Google"}`, before: before.driveAccountEmail, after: email, userId: user.id }),
    ]);
    forgetAccessToken();
    return back(request, "conectado");
  } catch (e) {
    console.error(e);
    return back(request, "error");
  }
}

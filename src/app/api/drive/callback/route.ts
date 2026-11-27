import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { DRIVE_SCOPE, exchangeCode, forgetAccessToken, getSettings } from "@/lib/drive";

function back(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin/configuracion?drive=${status}`, request.url));
}

function emailFromIdToken(idToken?: string) {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.redirect(new URL("/", request.url));

  const jar = await cookies();
  const expected = jar.get("drive_oauth_state")?.value;
  jar.delete({ name: "drive_oauth_state", path: "/api/drive" });
  const { searchParams } = request.nextUrl;
  if (searchParams.get("error")) return back(request, "cancelado");
  if (!expected || searchParams.get("state") !== expected) return back(request, "error");

  try {
    const token = await exchangeCode(searchParams.get("code") ?? "", new URL("/api/drive/callback", request.nextUrl.origin).toString());
    if (!token.scope.includes(DRIVE_SCOPE)) return back(request, "sin-permiso");
    if (!token.refresh_token) return back(request, "sin-llave");

    const email = emailFromIdToken(token.id_token);
    const before = await getSettings();
    // RF-26: con otra cuenta hay que volver a elegir la carpeta.
    const sameAccount = before.driveAccountEmail && before.driveAccountEmail === email;
    await db.batch([
      db
        .update(settings)
        .set({
          driveRefreshTokenEnc: encrypt(token.refresh_token),
          driveAccountEmail: email,
          driveConnectedAt: new Date(),
          driveDisconnectedAt: null,
          ...(sameAccount ? {} : { driveRootFolderId: null, driveRootFolderName: null, driveBackupsFolderId: null, driveContingencyFileId: null }),
        })
        .where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "conectar", before: before.driveAccountEmail, after: email, userId: user.id }),
    ]);
    forgetAccessToken();
    return back(request, "conectado");
  } catch (e) {
    console.error(e);
    return back(request, "error");
  }
}

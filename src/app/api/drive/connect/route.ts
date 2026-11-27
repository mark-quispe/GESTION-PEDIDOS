import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { DRIVE_SCOPE } from "@/lib/drive";

/** RF-22: «Conectar Drive». Permiso aparte del login y solo para el admin. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.redirect(new URL("/", request.url));
  if (!process.env.AUTH_GOOGLE_ID) return NextResponse.redirect(new URL("/configuracion?drive=sin-google", request.url));

  const state = crypto.randomUUID();
  (await cookies()).set("drive_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/drive" });
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID,
    redirect_uri: new URL("/api/drive/callback", request.nextUrl.origin).toString(),
    response_type: "code",
    scope: `openid email ${DRIVE_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  if (user.email) params.set("login_hint", user.email);
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

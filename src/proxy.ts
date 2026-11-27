import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Todo menos la API de auth, el cron, estáticos, iconos y la PWA.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|icons|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|offline.html).*)"],
};

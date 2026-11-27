import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * RF-22: el refresh token de Drive se guarda cifrado (AES-256-GCM).
 * La llave sale de DRIVE_ENCRYPTION_KEY; si se cambia, hay que volver a conectar Drive.
 */
function key() {
  const secret = process.env.DRIVE_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Falta DRIVE_ENCRYPTION_KEY (mínimo 32 caracteres).");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string) {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Formato de llave cifrada no válido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(buf: Buffer | string) {
  return createHash("sha256").update(buf).digest("hex");
}

import crypto from "node:crypto";

const SECRET =
  process.env.APP_SECRET ||
  process.env.JWT_SECRET ||
  process.env.DATABASE_URL ||
  "media-tracker-local-secret";

const KEY = crypto.createHash("sha256").update(SECRET).digest();

const PREFIX = "enc:v1:";

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  if (plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(value: string | undefined | null): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      KEY,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, Math.max(6, value.length - 2)))}${value.slice(-2)}`;
}

export function isSecretSet(value: string | undefined | null): boolean {
  return Boolean(value && value.length > 0);
}

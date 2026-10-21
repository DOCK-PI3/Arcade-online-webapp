import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("hex");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function secretFile(directory, name) {
  const path = join(directory, name);
  if (!existsSync(path))
    writeFileSync(path, token(), { mode: 0o600, flag: "wx" });
  return readFileSync(path, "utf8").trim();
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  const [salt, expected] = stored.split(":");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}
export function readCookie(req) {
  const part = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("arcade_sid="));
  return part?.slice(11) || "";
}

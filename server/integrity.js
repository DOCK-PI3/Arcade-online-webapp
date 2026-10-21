import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
export function emulatorIntegrity(root) {
  const path = join(root, "config/emulator-lock.json");
  if (!existsSync(path))
    return { ok: false, errors: ["No hay manifiesto de versión."] };
  const lock = JSON.parse(readFileSync(path, "utf8")),
    errors = [];
  for (const file of lock.files) {
    const location = join(root, "public/emulator", file.path);
    if (!existsSync(location)) {
      errors.push("Falta " + file.path);
      continue;
    }
    const actual = createHash("sha256")
      .update(readFileSync(location))
      .digest("hex");
    if (actual !== (file.installedSha256 || file.sha256))
      errors.push("Hash incorrecto: " + file.path);
  }
  return {
    ok: errors.length === 0,
    version: lock.version,
    files: lock.files.length,
    errors,
  };
}

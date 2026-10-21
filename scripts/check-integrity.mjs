import { emulatorIntegrity } from "../server/integrity.js";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const integrity = emulatorIntegrity(root);
console.log(JSON.stringify(integrity, null, 2));
let failed = !integrity.ok;
const romDir = resolve(process.env.DATA_DIR || join(root, "data"), "roms");
try {
  const manifest = JSON.parse(
    await readFile(join(romDir, "import-manifest.json"), "utf8"),
  );
  for (const file of manifest.files) {
    if (!/^[\w-]+\.zip$/.test(file.name))
      throw new Error("Manifiesto de ROMs no válido");
    const data = await readFile(join(romDir, file.name));
    const good =
      createHash("sha256").update(data).digest("hex") === file.sha256;
    console.log(file.name + ": " + (good ? "SHA-256 correcto" : "HA CAMBIADO"));
    if (!good) failed = true;
  }
} catch (e) {
  if (e.code === "ENOENT")
    console.log("No hay manifiesto de importación de ROMs.");
  else throw e;
}
if (failed) process.exitCode = 1;

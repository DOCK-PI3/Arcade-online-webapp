import { copyFile, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { catalogAdditions } from "../server/catalog.js";
import { romRequirements } from "./rom-requirements.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
const requirements = romRequirements();
const approvedHashes = new Map(
  [...requirements.games, ...requirements.bios].map((entry) => [
    entry.archive,
    entry.sha256,
  ]),
);
if (!source)
  throw new Error('Uso: node scripts/import-roms.mjs "CARPETA_DE_ZIP_FBNEO"');
const destination = resolve(process.env.DATA_DIR || join(root, "data"), "roms");
await mkdir(destination, { recursive: true });
let prior = { files: [] };
try {
  prior = JSON.parse(
    await readFile(join(destination, "import-manifest.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const manifest = new Map(prior.files.map((file) => [file.name, file]));
for (const name of new Set([
  "columns.zip",
  "contra.zip",
  "mslug.zip",
  "mslug2.zip",
  "1941.zip",
  "neogeo.zip",
  ...catalogAdditions.flatMap((game) => [game.rom, game.bios].filter(Boolean)),
])) {
  const path = join(resolve(source), name);
  let data;
  try {
    const s = await stat(path);
    if (s.size > 128 * 1024 * 1024) throw new Error("Archivo demasiado grande");
    data = await readFile(path);
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log("No encontrado: " + name);
      continue;
    }
    throw e;
  }
  if (data.readUInt32LE(0) !== 0x04034b50)
    throw new Error(name + " no parece un ZIP válido");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const approved = approvedHashes.get(name);
  if (approved && approved !== sha256) {
    console.log(
      name +
        ": no se sustituye el ZIP; no coincide con el lector aprobado. " +
        "Utiliza scripts/prepare-catalog-roms.py y consulta docs/ROMS_COMPATIBLES.md.",
    );
    continue;
  }
  await copyFile(path, join(destination, name));
  manifest.set(name, {
    name,
    bytes: data.length,
    sha256,
  });
  console.log("Copiado: " + name);
}
await writeFile(
  join(destination, "import-manifest.json"),
  JSON.stringify(
    { importedAt: new Date().toISOString(), files: [...manifest.values()] },
    null,
    2,
  ) + "\n",
);
console.log(
  "Importación terminada. Los originales no se han modificado. Falta validar cada juego en el núcleo web.",
);

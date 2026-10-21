import { list as tarList, extract as tarExtract } from "tar";
import { mkdir, rename, readdir, rm, access } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

const [archiveArg, destinationArg] = process.argv.slice(2);
if (!archiveArg || !destinationArg)
  throw new Error(
    "Uso: node scripts/restore-backup.mjs ARCHIVO.tar.gz NUEVA_CARPETA_DE_DATOS",
  );
const file = resolve(archiveArg),
  destination = resolve(destinationArg);
let exists = true;
try {
  await access(destination);
} catch (e) {
  if (e.code === "ENOENT") exists = false;
  else throw e;
}
if (exists)
  throw new Error(
    "La carpeta de destino debe ser nueva. No se sobrescribe ningún servidor existente.",
  );
const files = [];
let invalid = false;
await tarList({
  file,
  onReadEntry: (entry) => {
    const path = entry.path.replace(/\/$/, "");
    const allowed =
      /^salon-arcade(?:\/uploads(?:\/[a-f0-9-]+\.webp)?|\/encryption-key|\/\.backup-[a-f0-9-]+\.sqlite)?$/.test(
        path,
      );
    if (
      !allowed ||
      !["File", "Directory"].includes(entry.type) ||
      entry.linkpath
    )
      invalid = true;
    files.push(path);
    entry.resume();
  },
});
if (
  invalid ||
  !files.includes("salon-arcade/encryption-key") ||
  files.filter((p) => p.endsWith(".sqlite")).length !== 1
)
  throw new Error(
    "La copia contiene entradas no admitidas o le faltan archivos necesarios.",
  );
await mkdir(destination, { recursive: true });
const staging = join(destination, ".restore-stage");
await mkdir(staging);
await tarExtract({ file, cwd: staging, preservePaths: false, strict: true });
const content = join(staging, "salon-arcade"),
  database = files
    .find((p) => p.endsWith(".sqlite"))
    .split("/")
    .at(-1);
const db = new DatabaseSync(join(content, database));
try {
  if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok")
    throw new Error("La integridad de la base de datos no es correcta.");
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Hay referencias inconsistentes en la base de datos.");
  db.exec("DELETE FROM sessions; DELETE FROM challenges;");
} finally {
  db.close();
}
await rename(join(content, database), join(destination, "arcade.sqlite"));
await rename(
  join(content, "encryption-key"),
  join(destination, "encryption-key"),
);
await rename(join(content, "uploads"), join(destination, "uploads"));
if (!staging.startsWith(destination + sep))
  throw new Error("Ruta de limpieza no válida.");
await rm(staging, { recursive: true });
console.log(
  "Copia restaurada en " +
    destination +
    ". Se han cerrado todas las sesiones. Importa las ROMs por separado y usa DATA_DIR para apuntar a esta carpeta.",
);

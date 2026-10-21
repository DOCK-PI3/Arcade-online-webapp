import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error("En Linux utiliza el despliegue Caddy de Compose.");
const lock = JSON.parse(
  await readFile(new URL("../config/caddy-lock.json", import.meta.url)),
);
const dir = resolve(".cache/caddy");
await mkdir(dir, { recursive: true });
const response = await fetch(lock.url);
if (!response.ok) throw Error("No se pudo descargar Caddy: " + response.status);
const zip = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(zip).digest("hex") !== lock.sha256)
  throw Error("El hash de Caddy no coincide.");
const file = join(dir, "caddy.zip");
await writeFile(file, zip);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath ${quote(file)} -DestinationPath ${quote(dir)} -Force`,
  ],
  { stdio: "inherit", windowsHide: true },
);
console.log(
  "Caddy " + lock.version + " instalado y verificado en .cache/caddy.",
);

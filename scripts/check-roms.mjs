import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { romRequirements } from "./rom-requirements.mjs";
const args = process.argv.slice(2),
  json = args.includes("--json"),
  paths = args.filter((a) => a !== "--json");
if (paths.length > 1)
  throw Error(
    "Uso: npm run roms:check -- [CARPETA_DE_ZIP_PREPARADOS] [--json]",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = paths[0]
  ? resolve(paths[0])
  : resolve(process.env.DATA_DIR || resolve(root, "data"), "roms");
const requirements = romRequirements(),
  results = [];
for (const entry of [...requirements.games, ...requirements.bios]) {
  let status = "ok",
    actual = null;
  try {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(
      resolve(directory, entry.archive),
    ))
      hash.update(chunk);
    actual = hash.digest("hex");
    if (actual !== entry.sha256) status = "incompatible";
  } catch (error) {
    if (error.code === "ENOENT") status = "missing";
    else throw error;
  }
  results.push({
    archive: entry.archive,
    status,
    expectedSha256: entry.sha256,
    actualSha256: actual,
  });
}
const ok = results.every((r) => r.status === "ok"),
  summary = {
    ok,
    directory,
    required: results.length,
    ready: results.filter((r) => r.status === "ok").length,
    results,
  };
if (json) console.log(JSON.stringify(summary, null, 2));
else {
  for (const r of results)
    console.log(
      `${r.archive}: ${{ ok: "SHA-256 aprobado", missing: "FALTA", incompatible: "INCOMPATIBLE; preparar el ZIP correcto" }[r.status]}`,
    );
  console.log(
    `${summary.ready}/${summary.required} ZIP aprobados. Consulta docs/ROMS_COMPATIBLES.md.`,
  );
}
if (!ok) process.exitCode = 1;

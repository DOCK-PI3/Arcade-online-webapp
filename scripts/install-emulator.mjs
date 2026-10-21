import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public/emulator"),
  lockPath = join(root, "config/emulator-lock.json");
const source =
  "https://raw.githubusercontent.com/EmulatorJS/EmulatorJS/v4.2.3/";
const files = [
  "loader.js",
  "emulator.css",
  "version.json",
  "localization/es-ES.json",
  ...[
    "emulator.js",
    "GameManager.js",
    "compression.js",
    "gamepad.js",
    "nipplejs.js",
    "shaders.js",
    "socket.io.min.js",
    "storage.js",
  ].map((x) => "src/" + x),
  ...["extract7z.js", "extractzip.js", "libunrar.js", "libunrar.wasm"].map(
    (x) => "compression/" + x,
  ),
];
const entries = files.map((path) => ({ path, url: source + "data/" + path }));
entries.push({ path: "LICENSE", url: source + "LICENSE" });
for (const path of [
  "cores/fbneo-wasm.data",
  "cores/fbneo-legacy-wasm.data",
  "cores/reports/fbneo.json",
  "cores/mame2003_plus-wasm.data",
  "cores/reports/mame2003_plus.json",
])
  entries.push({ path, url: "https://cdn.emulatorjs.org/4.2.3/data/" + path });
let previous;
try {
  previous = JSON.parse(await readFile(lockPath, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const results = [];
// Deliberately bounded downloads; no CDN dependency remains at runtime.
for (let i = 0; i < entries.length; i += 4) {
  await Promise.all(
    entries.slice(i, i + 4).map(async (entry) => {
      const response = await fetch(entry.url, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok)
        throw new Error(
          `No se pudo descargar ${entry.path}: HTTP ${response.status}`,
        );
      let buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 100 * 1024 * 1024)
        throw new Error("Archivo demasiado grande: " + entry.path);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const expected = previous?.files.find((f) => f.path === entry.path);
      if (expected && expected.sha256 !== sha256)
        throw new Error(
          "El archivo oficial ha cambiado y no coincide con el lock: " +
            entry.path,
        );
      if (entry.path === "src/emulator.js") {
        // One documented patch: a fixed installation never checks an external CDN at runtime.
        const before =
          'if (this.debug || (window.location && ["localhost", "127.0.0.1"].includes(location.hostname))) this.checkForUpdates();';
        if (!buffer.toString().includes(before))
          throw new Error(
            "No se pudo aplicar el parche de funcionamiento sin CDN.",
          );
        buffer = Buffer.from(
          buffer
            .toString()
            .replace(
              before,
              "/* Salón Arcade: pinned offline installation; update checks disabled. */",
            ),
        );
      }
      const destination = join(output, entry.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination + ".partial", buffer);
      await rename(destination + ".partial", destination);
      results.push({
        ...entry,
        sha256,
        installedSha256: createHash("sha256").update(buffer).digest("hex"),
        bytes: buffer.length,
      });
      console.log(`${entry.path}: ${(buffer.length / 1024).toFixed(0)} KB`);
    }),
  );
}
const manifest = {
  version: "4.2.3",
  core: "fbneo",
  files: results.sort((a, b) => a.path.localeCompare(b.path)),
};
await mkdir(dirname(lockPath), { recursive: true });
await writeFile(lockPath, JSON.stringify(manifest, null, 2) + "\n");
await writeFile(
  join(output, "install-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "EmulatorJS y FBNeo instalados localmente. No se han descargado ROMs ni BIOS.",
);

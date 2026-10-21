import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { emulatorIntegrity } from "../server/integrity.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const [mode, ...options] = process.argv.slice(2);
const windows = process.platform === "win32";
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, ".cache/server-browsers");

function run(executable, args) {
  console.log("\n> " + [executable, ...args].join(" "));
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      `La instalacion se ha detenido (${result.signal || result.status}). Corrige el paso anterior y repite el instalador.`,
    );
}
function npm(args) {
  if (windows)
    run(process.env.ComSpec || "cmd.exe", ["/d", "/c", "npm.cmd", ...args]);
  else run("npm", args);
}
async function check() {
  for (const file of [
    "node_modules/express/package.json",
    "node_modules/playwright/package.json",
    "dist/index.html",
  ]) {
    if (!existsSync(join(root, file)))
      throw Error(`Falta ${file}. Ejecuta el instalador de tu sistema.`);
  }
  const integrity = emulatorIntegrity(root);
  if (!integrity.ok)
    throw Error(
      "El emulador necesita reinstalarse: " + integrity.errors.join("; "),
    );
  const { chromium } = await import("playwright");
  if (!existsSync(chromium.executablePath()))
    throw Error("Falta Chromium del servidor. Ejecuta el instalador.");
  console.log(
    `Instalacion preparada: Node ${process.versions.node}, web compilada, emulador verificado y Chromium presente.`,
  );
}
async function portOccupied(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (e) =>
      e.code === "ECONNREFUSED" ? resolve(false) : reject(e),
    );
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(Error("No se pudo comprobar si el servidor esta detenido."));
    });
  });
}
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major !== 24 || minor < 15)
    throw Error(
      "Se necesita Node.js 24.15 o posterior de la rama 24. Ejecuta el instalador.",
    );
  if (!["win32", "linux"].includes(process.platform))
    throw Error("Este instalador admite Windows y Linux.");
  if (
    !["install", "check"].includes(mode) ||
    options.some((o) => mode !== "install" || o !== "--skip-system-deps")
  )
    throw Error(
      "Uso: node scripts/setup-server.mjs install [--skip-system-deps] | check",
    );
  if (mode === "install") {
    // npm ci replaces node_modules; require the application to be stopped first.
    const port = Number(process.env.PORT || 3000);
    if (
      (await portOccupied(port)) ||
      (port !== 3000 && (await portOccupied(3000)))
    )
      throw Error(
        "El servidor o su puerto estan en uso. Detenlo antes de instalar; despues vuelve a arrancarlo.",
      );
    npm(["ci", "--include=dev"]);
    if (emulatorIntegrity(root).ok)
      console.log("Emulador existente: hashes correctos, se reutiliza.");
    else run(process.execPath, ["scripts/install-emulator.mjs"]);
    if (!windows && !options.includes("--skip-system-deps"))
      run(process.execPath, [
        "node_modules/playwright/cli.js",
        "install-deps",
        "chromium",
      ]);
    run(process.execPath, ["scripts/install-server.mjs"]);
    if (windows) run(process.execPath, ["scripts/install-network.mjs"]);
    npm(["run", "build"]);
    run(process.execPath, [
      "--env-file-if-exists=.env",
      "scripts/check-integrity.mjs",
    ]);
    await check();
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      channel: "chromium",
      chromiumSandbox: true,
      args: ["--mute-audio"],
    });
    await browser.close();
    console.log("\nInstalacion terminada. Los datos existentes se conservan.");
    console.log(
      windows
        ? "Ejecuta Iniciar-Windows.cmd (LAN/HTTPS) o Iniciar-Windows.cmd -LocalOnly (solo este PC)."
        : "Ejecuta bash iniciar-linux.sh. Para otros equipos configura HTTPS segun docs/INSTALACION.md.",
    );
    console.log(
      "Los juegos requieren tus ZIP y BIOS en data/roms. El instalador no los descarga.",
    );
  } else await check();
} catch (error) {
  console.error("\nERROR: " + error.message);
  process.exitCode = 1;
}

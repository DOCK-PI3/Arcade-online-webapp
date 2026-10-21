import { create as tarCreate } from "tar";
import { mkdir, readdir, stat, rename, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";

export async function createBackup(db, dataDir) {
  const folder = join(dataDir, "backups");
  await mkdir(folder, { recursive: true });
  const files = await readdir(folder);
  if (files.filter((f) => f.endsWith(".tar.gz")).length >= 10)
    throw new Error(
      "Se conservan hasta 10 copias. Retira alguna desde el servidor antes de crear otra.",
    );
  const snapshot = join(dataDir, ".backup-" + randomUUID() + ".sqlite");
  const filename =
    "arcade-" + new Date().toISOString().replace(/[:.]/g, "-") + ".tar.gz";
  try {
    db.prepare("VACUUM INTO ?").run(snapshot);
    const entries = [
      snapshot.slice(dataDir.length + 1),
      "encryption-key",
      "uploads",
    ];
    await tarCreate(
      {
        cwd: dataDir,
        file: join(folder, filename + ".partial"),
        gzip: true,
        portable: true,
        noMtime: true,
        prefix: "salon-arcade",
        filter: (_path, entry) => !entry.isSymbolicLink?.(),
      },
      entries,
    );
    await rename(join(folder, filename + ".partial"), join(folder, filename));
    // Database and uploads are included; ROMs and installed emulator are reproducible and excluded.
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(join(folder, filename)))
      digest.update(chunk);
    return {
      filename,
      bytes: (await stat(join(folder, filename))).size,
      sha256: digest.digest("hex"),
      databaseEntry: "salon-arcade/" + snapshot.slice(dataDir.length + 1),
    };
  } finally {
    await unlink(snapshot).catch(() => {});
  }
}
export async function listBackups(dataDir) {
  const folder = join(dataDir, "backups");
  await mkdir(folder, { recursive: true });
  const names = (await readdir(folder)).filter((f) =>
    /^arcade-[\dTZ-]+\.tar\.gz$/.test(f),
  );
  return Promise.all(
    names
      .sort()
      .reverse()
      .map(async (filename) => {
        const s = await stat(join(folder, filename));
        return { filename, bytes: s.size, createdAt: s.mtimeMs };
      }),
  );
}

import { writeFile } from "node:fs/promises";
import { romRequirements } from "./rom-requirements.mjs";
const data = romRequirements(),
  root = new URL("../", import.meta.url);
await writeFile(
  new URL("config/rom-requirements.json", root),
  JSON.stringify(data, null, 2) + "\n",
);
const csv = [
  [
    "Juego",
    "ZIP",
    "BIOS",
    "Puestos",
    "Nucleo",
    "Romset de referencia",
    "Formato",
    "Preparacion",
    "SHA256",
    "ZIP padre o fuente",
  ],
  ...data.games.map((g) => [
    g.title,
    g.archive,
    g.bios || "",
    g.players,
    g.core,
    data.sourceSets[g.sourceSet].name,
    data.sourceSets[g.sourceSet].format,
    g.preparation,
    g.sha256,
    g.sourceArchives.join(", "),
  ]),
  ...data.bios.map((b) => [
    "BIOS " + b.id,
    b.archive,
    "",
    "",
    b.id === "neogeo" ? "fbneo" : "mame2003_plus",
    data.sourceSets[b.sourceSet].name,
    data.sourceSets[b.sourceSet].format,
    b.preparation,
    b.sha256,
    b.archive,
  ]),
];
await writeFile(
  new URL("docs/ROMS_COMPATIBLES.csv", root),
  "\uFEFF" +
    csv
      .map((row) =>
        row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(";"),
      )
      .join("\n") +
    "\n",
);
const lines = [
  "# ROMs compatibles y BIOS",
  "",
  `Lista generada con \`npm run roms:list\`: **${data.games.length} juegos y ${data.bios.length} BIOS (${data.games.length + data.bios.length} ZIP)**. Solo incluye el catálogo activo distribuido; Tetris y Tecmo World Cup 98 están retirados.`,
  "",
  "No se incluyen ROMs, BIOS ni enlaces a copias de los juegos. Cada instalación aporta sus archivos por separado. Las versiones siguientes identifican las colecciones utilizadas; el nombre del ZIP por sí solo no garantiza compatibilidad.",
  "",
  "## Romsets de referencia",
  "",
  "- **F:** FinalBurn Neo **1.0.0.3 (a2594cf)**, **Arcade only, Non-Merged**. Los seis ZIP originales de Columns, Contra, Metal Slug 1/2, 1941 y Neo Geo deben conservarse sin recomprimir. El preparador verifica sus hashes exactos.",
  "- **M:** **MAME 0.287 ROMs (merged)**. El preparador extrae los componentes concretos del padre/clon y utiliza F como segunda colección cuando sea necesario.",
  "- El núcleo web es el de **EmulatorJS 4.2.3**, fijado por `config/emulator-lock.json`. Salamander 2 utiliza **MAME 2003 Plus**, no MAME 0.287 como motor. Sus componentes se seleccionan por CRC/tamaño para ese núcleo.",
  "",
  "La ruta recomendada es preparar los archivos con **ambas colecciones locales**; no es necesario copiarlas enteras al servidor. [Instalación desde Git y preparación de ROMs](PUBLICAR_EN_GIT.md).",
  "",
  "## Juegos",
  "",
  "| Juego | ZIP final | BIOS | Puestos | Núcleo | Fuente | ZIP de origen/padre |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...data.games.map(
    (g) =>
      `| ${g.title} | \`${g.archive}\` | ${g.bios ? "`" + g.bios + "`" : "—"} | ${g.players} | ${g.core === "fbneo" ? "FBNeo" : "MAME 2003 Plus"} | ${g.sourceSet === "fbneo" ? "F" : "M"} | ${g.sourceArchives.map((s) => "`" + s + "`").join(", ")} |`,
  ),
  "",
  "## BIOS compartidas",
  "",
  "| Archivo | Fuente | Juegos que lo necesitan |",
  "| --- | --- | --- |",
  ...data.bios.map(
    (b) =>
      `| \`${b.archive}\` | ${b.sourceSet === "fbneo" ? "F" : "M"} | ${b.requiredBy.join(", ")} |`,
  ),
  "",
  "## Directorio final y comprobación",
  "",
  "Los 48 ZIP preparados van juntos, **sin descomprimirlos ni crear subcarpetas**, en `data/roms/`. Si configuras `DATA_DIR`, van en `<DATA_DIR>/roms/`. Los nombres distinguen mayúsculas y minúsculas en Linux.",
  "",
  "Ejecuta `npm run roms:check` antes de arrancar. Esta comprobación revisa los 46 juegos y las dos BIOS, y falla si falta un archivo o su SHA-256 no está aprobado. No modifica archivos ni crea usuarios.",
  "",
  "Los hashes aprobados están en [ROMS_COMPATIBLES.csv](ROMS_COMPATIBLES.csv) y `config/rom-requirements.json`. Los nombres, tamaños y CRC de cada componente están en `config/catalog-romsets.json`. Estos ficheros son metadatos y se incluyen en Git.",
  "",
  "## Referencias y obtención de archivos",
  "",
  "Aporta los ZIP de una colección que puedas utilizar. Los proyectos de emulación enlazados documentan el formato y la reconstrucción; no se presentan como descargas de los 46 juegos comerciales de este catálogo.",
  "",
  "- [FBNeo: construir romsets con el DAT correspondiente](https://docs.libretro.com/library/fbneo/#building-romsets-for-fbneo).",
  "- [MAME: tipos de romsets y dependencias padre/clon/BIOS](https://docs.mamedev.org/usingmame/aboutromsets.html).",
  "",
  "No cambies el nombre de otra revisión ni sustituyas los hashes para forzar la aceptación: los lectores de puntuación dependen del contenido aprobado. Si el preparador indica componentes ausentes, aporta la colección adecuada; conserva el ZIP instalado cuando encuentra una discrepancia.",
];
await writeFile(
  new URL("docs/ROMS_COMPATIBLES.md", root),
  lines.join("\n") + "\n",
);
console.log(
  `${data.games.length} juegos y ${data.bios.length} BIOS: lista Markdown, CSV y JSON generada sin ROMs.`,
);

# ROMs compatibles y BIOS

Lista generada con `npm run roms:list`: **46 juegos y 2 BIOS (48 ZIP)**. Solo incluye el catálogo activo distribuido; Tetris y Tecmo World Cup 98 están retirados.

No se incluyen ROMs, BIOS ni enlaces a copias de los juegos. Cada instalación aporta sus archivos por separado. Las versiones siguientes identifican las colecciones utilizadas; el nombre del ZIP por sí solo no garantiza compatibilidad.

## Romsets de referencia

- **F:** FinalBurn Neo **1.0.0.3 (a2594cf)**, **Arcade only, Non-Merged**. Los seis ZIP originales de Columns, Contra, Metal Slug 1/2, 1941 y Neo Geo deben conservarse sin recomprimir. El preparador verifica sus hashes exactos.
- **M:** **MAME 0.287 ROMs (merged)**. El preparador extrae los componentes concretos del padre/clon y utiliza F como segunda colección cuando sea necesario.
- El núcleo web es el de **EmulatorJS 4.2.3**, fijado por `config/emulator-lock.json`. Salamander 2 utiliza **MAME 2003 Plus**, no MAME 0.287 como motor. Sus componentes se seleccionan por CRC/tamaño para ese núcleo.

La ruta recomendada es preparar los archivos con **ambas colecciones locales**; no es necesario copiarlas enteras al servidor. [Instalación desde Git y preparación de ROMs](PUBLICAR_EN_GIT.md).

## Juegos

| Juego | ZIP final | BIOS | Puestos | Núcleo | Fuente | ZIP de origen/padre |
| --- | --- | --- | --- | --- | --- | --- |
| 1941: Counter Attack | `1941.zip` | — | 2 | FBNeo | F | `1941.zip` |
| 1942 | `1942.zip` | — | 2 | FBNeo | M | `1942.zip` |
| 1943 Kai: Midway Kaisen | `1943kai.zip` | — | 2 | FBNeo | M | `1943kai.zip` |
| 1943: The Battle of Midway | `1943.zip` | — | 2 | FBNeo | M | `1943.zip` |
| 1943: The Battle of Midway Mark II | `1943mii.zip` | — | 2 | FBNeo | M | `1943mii.zip` |
| 1944: The Loop Master | `1944.zip` | — | 2 | FBNeo | M | `1944.zip` |
| 1945k III | `1945kiii.zip` | — | 2 | FBNeo | M | `1945kiii.zip` |
| 88 Games | `88games.zip` | — | 2 | FBNeo | M | `88games.zip` |
| Alien vs. Predator | `avsp.zip` | — | 3 | FBNeo | F | `avsp.zip` |
| Aliens | `aliens.zip` | — | 2 | FBNeo | M | `aliens.zip` |
| Altered Beast | `altbeast.zip` | — | 2 | FBNeo | M | `altbeast.zip` |
| Asterix | `asterix.zip` | — | 2 | FBNeo | M | `asterix.zip` |
| Bad Dudes vs. Dragonninja | `baddudes.zip` | — | 2 | FBNeo | M | `baddudes.zip` |
| Columns (World) | `columns.zip` | — | 2 | FBNeo | F | `columns.zip` |
| Contra | `contra.zip` | — | 2 | FBNeo | F | `contra.zip` |
| Crazy Climber | `cclimber.zip` | — | 2 | FBNeo | F | `cclimber.zip` |
| Crazy Climber 2 | `cclimbr2.zip` | — | 2 | FBNeo | F | `cclimbr2.zip` |
| Darius | `darius.zip` | — | 2 | FBNeo | M | `darius.zip` |
| Demon’s World / Horror Story | `demonwld.zip` | — | 2 | FBNeo | F | `demonwld.zip` |
| Forgotten Worlds | `forgottn.zip` | — | 2 | FBNeo | M | `forgottn.zip` |
| Frogger | `frogger.zip` | — | 2 | FBNeo | F | `frogger.zip` |
| G.I. Joe | `gijoe.zip` | — | 4 | FBNeo | F | `gijoe.zip` |
| Galaga '88 | `galaga88.zip` | — | 2 | FBNeo | M | `galaga88.zip` |
| Gradius | `gradius.zip` | — | 2 | FBNeo | F | `gradius.zip`, `nemesis.zip` |
| Jackal | `jackal.zip` | — | 2 | FBNeo | M | `jackal.zip` |
| Joe & Mac | `joemac.zip` | — | 2 | FBNeo | F | `joemac.zip`, `cninja.zip` |
| Kick Off: Jaleco Cup | `kickoff.zip` | — | 2 | FBNeo | F | `kickoff.zip` |
| Magician Lord | `maglord.zip` | `neogeo.zip` | 2 | FBNeo | F | `maglord.zip` |
| Mercs | `mercs.zip` | — | 3 | FBNeo | F | `mercs.zip` |
| Metal Slug | `mslug.zip` | `neogeo.zip` | 2 | FBNeo | F | `mslug.zip` |
| Metal Slug 2 | `mslug2.zip` | `neogeo.zip` | 2 | FBNeo | F | `mslug2.zip` |
| Michael Jackson’s Moonwalker | `mwalk.zip` | — | 3 | FBNeo | F | `mwalk.zip` |
| NARC | `narc.zip` | — | 2 | FBNeo | F | `narc.zip` |
| OutRunners | `orunners.zip` | — | 2 | FBNeo | F | `orunners.zip` |
| Prehistoric Isle 2 | `preisle2.zip` | `neogeo.zip` | 2 | FBNeo | M | `preisle2.zip` |
| Prehistoric Isle in 1930 | `prehisle.zip` | — | 2 | FBNeo | M | `prehisle.zip` |
| Puzzle Bobble | `pbobble.zip` | — | 2 | FBNeo | M | `pbobble.zip` |
| Rolling Thunder | `rthunder.zip` | — | 2 | FBNeo | M | `rthunder.zip` |
| Rolling Thunder 2 | `rthun2.zip` | — | 2 | FBNeo | M | `rthun2.zip` |
| Salamander | `salamand.zip` | — | 2 | FBNeo | M | `salamand.zip` |
| Salamander 2 | `salmndr2.zip` | `konamigx.zip` | 2 | MAME 2003 Plus | M | `salmndr2.zip`, `konamigx.zip` |
| Shinobi | `shinobi.zip` | — | 2 | FBNeo | M | `shinobi.zip` |
| Teenage Mutant Ninja Turtles (2 jugadores) | `tmnt2po.zip` | — | 2 | FBNeo | M | `tmnt2po.zip`, `tmnt.zip` |
| The King of Fighters ’98 | `kof98.zip` | `neogeo.zip` | 2 | FBNeo | F | `kof98.zip` |
| Three Wonders | `3wonders.zip` | — | 2 | FBNeo | F | `3wonders.zip` |
| TwinBee | `twinbee.zip` | — | 2 | FBNeo | M | `twinbee.zip` |

## BIOS compartidas

| Archivo | Fuente | Juegos que lo necesitan |
| --- | --- | --- |
| `neogeo.zip` | F | maglord, mslug, mslug2, preisle2, kof98 |
| `konamigx.zip` | M | salmndr2 |

## Directorio final y comprobación

Los 48 ZIP preparados van juntos, **sin descomprimirlos ni crear subcarpetas**, en `data/roms/`. Si configuras `DATA_DIR`, van en `<DATA_DIR>/roms/`. Los nombres distinguen mayúsculas y minúsculas en Linux.

Ejecuta `npm run roms:check` antes de arrancar. Esta comprobación revisa los 46 juegos y las dos BIOS, y falla si falta un archivo o su SHA-256 no está aprobado. No modifica archivos ni crea usuarios.

Los hashes aprobados están en [ROMS_COMPATIBLES.csv](ROMS_COMPATIBLES.csv) y `config/rom-requirements.json`. Los nombres, tamaños y CRC de cada componente están en `config/catalog-romsets.json`. Estos ficheros son metadatos y se incluyen en Git.

## Referencias y obtención de archivos

Aporta los ZIP de una colección que puedas utilizar. Los proyectos de emulación enlazados documentan el formato y la reconstrucción; no se presentan como descargas de los 46 juegos comerciales de este catálogo.

- [FBNeo: construir romsets con el DAT correspondiente](https://docs.libretro.com/library/fbneo/#building-romsets-for-fbneo).
- [MAME: tipos de romsets y dependencias padre/clon/BIOS](https://docs.mamedev.org/usingmame/aboutromsets.html).

No cambies el nombre de otra revisión ni sustituyas los hashes para forzar la aceptación: los lectores de puntuación dependen del contenido aprobado. Si el preparador indica componentes ausentes, aporta la colección adecuada; conserva el ZIP instalado cuando encuentra una discrepancia.

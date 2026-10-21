# Ampliación FBNeo — 18 de octubre de 2026

Los 16 juegos aprobados están activos. El salón pasa de 30 a **46 juegos** y de 80 a **96 medallas**: 50 generales y una de primer puesto por juego. Los ZIP se han preparado con componentes de las colecciones locales del propietario, conservando los originales. Se comprueban nombres, tamaños, CRC y SHA-256 contra el núcleo fijado; no se han descargado ROMs.

| Juego | ZIP original | Puestos | Modalidad |
| --- | --- | --- | --- |
| Three Wonders | `3wonders.zip` | 2 | Simultáneos |
| Alien vs. Predator | `avsp.zip` | 3 | Simultáneos |
| Crazy Climber | `cclimber.zip` | 2 | Por turnos, dos palancas |
| Crazy Climber 2 | `cclimbr2.zip` | 2 | Por turnos, dos palancas |
| Demon’s World / Horror Story | `demonwld.zip` | 2 | Simultáneos, inicio conjunto |
| Frogger | `frogger.zip` | 2 | Por turnos |
| G.I. Joe | `gijoe.zip` | 4 | Simultáneos |
| Gradius | `gradius.zip` | 2 | Por turnos |
| Joe & Mac | `joemac.zip` | 2 | Simultáneos |
| Kick Off: Jaleco Cup | `kickoff.zip` | 2 | Enfrentados, inicio conjunto |
| The King of Fighters ’98 | `kof98.zip` | 2 | Enfrentados |
| Magician Lord | `maglord.zip` | 2 | Por turnos |
| Mercs | `mercs.zip` | 3 | Simultáneos |
| Michael Jackson’s Moonwalker | `mwalk.zip` | 3 | Simultáneos |
| NARC | `narc.zip` | 2 | Simultáneos |
| OutRunners | `orunners.zip` | 2 | Enfrentados, dos pantallas |

KOF ’98 y Magician Lord utilizan la BIOS `neogeo.zip` ya instalada. El nombre canónico de la ROM solicitada como «demonworld» es `demonwld.zip`.

## Controles y crédito

Cada usuario inserta un crédito y pulsa Inicio. En los juegos por turnos, Demon’s World y Kick Off hay que insertar **los dos créditos antes del primer Inicio** para activar ambos puestos. Durante algunas introducciones se puede repetir Inicio hasta que el motor observe juego real. Cada cuenta conserva su identidad y su puerto de control, incluso cuando la máquina comparte monedero.

Crazy Climber 1 y 2 usan la cruceta o el stick izquierdo para la mano izquierda. El stick derecho mueve la derecha; también se puede usar A arriba, B abajo, C izquierda y D derecha. Para subir hay que alternar los movimientos de ambas manos. Los botones táctiles muestran las flechas de la mano derecha.

OutRunners usa la cruceta o el stick izquierdo para dirigir; A acelera, B frena y C/D cambian de marcha al elegir transmisión manual. Los botones táctiles muestran Gas, Freno y Marcha. Los dos pilotos tienen acelerador, freno y dirección independientes.

Alien vs. Predator se inicializa como máquina de tres jugadores con monederos separados; G.I. Joe usa cuatro jugadores. NARC completa su inicialización de fábrica y se reinicia antes de admitir los créditos de los usuarios. Estos pasos se realizan automáticamente antes de anunciar que el motor está preparado.

## Marcadores y medallas

Los lectores usan únicamente la RAM del motor privado del servidor. Están ligados al hash del ZIP y al tamaño de memoria del núcleo fijado. Cada puesto registra su máximo durante el crédito; al terminar la participación o salir de la sala se publica el resultado. Las demostraciones y los puestos que no han comenzado una participación no generan marcas.

- **Kick Off:** goles marcados por cada equipo. Si el juego reinicia un empate se conserva el máximo de goles observado durante ese crédito.
- **OutRunners:** recorrido alcanzado, expresado en tramos de pista del motor. Gana el recorrido mayor, también cuando se agota el tiempo. Esta modalidad fue aprobada expresamente por el propietario. La selección de coche y las demostraciones posteriores no cuentan.
- **KOF ’98:** máximo del contador nativo observado durante el crédito. El juego restaura o reinicia puntos entre combates; el salón conserva el mejor valor observado, incluidos los combates entre jugadores.
- En los demás juegos se lee la puntuación nativa de cada puesto. Se respetan los cambios de turno, las últimas vidas y los contadores que se borran al terminar.

El primer resultado finalizado que coloca a la cuenta en el primer puesto concede la medalla del juego. Los empates siguen el mismo orden por nombre de usuario del marcador. Las imágenes y los objetivos de exploración se amplían automáticamente con el catálogo.

## Pruebas realizadas

Se arrancaron los 16 juegos con el núcleo instalado. Se recogieron **134 muestras auténticas de RAM** adicionales, con puntos positivos, selección, turnos, combates, fin de participación y demostraciones. Las pruebas de regresión conservan solo las regiones necesarias para leer resultados, con 272 muestras en total.

En bases temporales se comprobó el circuito completo para los **37 puestos** de la ampliación: registro de cuentas, creación y unión a salas, asignación de puestos, crédito/inicio, reproducción de estados nativos auténticos, lectura de RAM, guardado en SQLite, coincidencia con el marcador público y medalla de primer puesto. Los estados reproducidos se obtuvieron jugando mediante controles; no se escribieron puntos en la memoria. Informes: `output/playwright/<juego>-release-verification.json`.

Las pruebas están silenciadas. No se han añadido cuentas ni resultados de prueba a la base del propietario. Estas verificaciones no sustituyen una partida prolongada con los mandos y dispositivos físicos del propietario, ni la prueba en el Linux de destino.

Los descriptores se contrastaron con los [drivers oficiales de FBNeo fijados al núcleo](https://github.com/finalburnneo/FBNeo/tree/c8c70ba4858458c44b7200b88a29ebbb48c9bb23/src/burn/drv). La carga Neo Geo se revisó con sus descriptores, protección e inicialización del driver, además del arranque real de KOF ’98 y Magician Lord.

# Ampliación de MAME — 16 de octubre de 2026

La lista efectiva y sus controles están en `config/catalog-additions.json`. Solo se activan fichas con un lector de puntuación aprobado para el ZIP y el núcleo instalados. Las cuentas, salas e historial existentes se conservan. Columns continúa sustituyendo al Tetris de Sega y la portada muestra las cinco últimas participaciones.

## Juegos preparados

1942; 1943; 1943 Kai; 1943: The Battle of Midway Mark II; 1944; 1945k III; ’88 Games; Aliens; Altered Beast; Asterix; Bad Dudes; Darius; Galaga '88; Jackal; Puzzle Bobble; Prehistoric Isle; Prehistoric Isle 2; Rolling Thunder; Rolling Thunder 2; Salamander; Salamander 2; Shinobi; TMNT de dos jugadores; TwinBee; Forgotten Worlds.

Todos tienen dos puestos en las salas. 1942, Galaga '88, Rolling Thunder y Shinobi alternan los turnos originales de la recreativa. TwinBee juega simultáneamente, pero también necesita iniciar la modalidad de dos jugadores desde el principio. En estos juegos ambos deben insertar su crédito antes del primer Inicio; la aplicación envía el Inicio correspondiente a dos participantes. TMNT utiliza `tmnt2po`, que permite elegir tortuga en una máquina de dos jugadores.

Forgotten Worlds utiliza el botón A para disparar y B/C para girar el arma. La reasignación se aplica a teclado, mando y controles táctiles. Desde el 17 de octubre se admite también jugar desde móviles y tablets Android con cruceta y botones virtuales automáticos; los controles se pueden ocultar para utilizar un mando.

Rolling Thunder 2 inicializa automáticamente su configuración antes de admitir créditos. El arranque de la sala puede tardar alrededor de un minuto y medio. Esta pulsación interna no consume el crédito ni el Inicio de ningún usuario.

## Integración de los tres últimos juegos

- **Shinobi:** el lector selecciona el banco actual y el banco conservado según el turno. Sigue por separado las vidas y los indicadores de fin de cada jugador; no intercambia sus puntuaciones al cambiar de turno. Se contrastó también una calibración privada con 2.345 y 1.234 puntos visibles en pantalla.
- **Salamander 2:** utiliza MAME 2003 Plus y la BIOS Konami GX aprobada por hash. La puntuación se guarda en unidades de cien puntos; los accesos de 32 bits y el desplazamiento del bloque de RAM dentro del estado necesitan conversión independiente. Se distinguen demostración, juego y fin de participación. La prueba completa publicó 1.900 y 3.200 puntos.
- **’88 Games:** el juego convierte las marcas deportivas en una puntuación total original por atleta. El marcador web registra ese total acumulado, conservándolo entre disciplinas y turnos; los tiempos y distancias siguen apareciendo dentro de la recreativa. A/B sirven para correr alternadamente y C para salto, acción y confirmar iniciales. Una carrera de 7,48 segundos produjo 1.856 puntos por participante en la prueba privada. La prueba completa con dos cuentas terminó de forma natural y publicó automáticamente 1.946 puntos para cada participante antes de abandonar la sala.

Tecmo World Cup ’98 se retiró de la lista a petición del propietario. Se mantiene la exclusión de `frogwld`, `spaceinv` y `supgoal`. La migración activa una sola vez las tres fichas que antes estaban preparadas y desactivadas; conserva el historial y respeta cambios administrativos posteriores.

## Preparación reproducible de los ZIP

Se utilizaron únicamente las colecciones locales del propietario. Los originales permanecen intactos. El conversor busca componentes por tamaño y CRC exactos, reúne los necesarios del padre y del clon y genera ZIP planos con nombres, orden y fechas fijos. El lector de puntuación comprueba además el SHA-256 del ZIP resultante. Esto evita utilizar direcciones de memoria con una revisión de ROM distinta.

```powershell
python scripts/prepare-catalog-roms.py "D:\MAME 0.287 ROMs (merged)" --fallback "D:\FinalBurn Neo 1.0.0.3 (a2594cf) (Arcade only) (Non-Merged)\Roms"
npm.cmd run integrity
```

Las definiciones están en `config/catalog-romsets.json`; `--games 1942 forgottn` permite preparar solo algunos títulos. Salamander 2 y `konamigx.zip` están incluidos con las definiciones específicas de MAME 2003 Plus. Se conservan las fechas del ZIP aprobado para reproducir exactamente su SHA-256; la reconstrucción se contrastó byte por byte con la instalación validada. El manifiesto de importación conserva los archivos anteriores y su procedencia. El importador directo no reemplaza un ZIP aprobado por otro hash.

## Puntuación, controles y pruebas

Los lectores de la ampliación están en `config/catalog-score-layouts.json`. Separan la puntuación y participación de cada puesto y distinguen vidas, cambios de turno o ronda y fin de partida según la máquina. Los fragmentos de memoria usados por las pruebas están en `tests/fixtures/catalog-score-memory.json`. No se acepta una puntuación enviada por el navegador del jugador.

1944 expone un banco de RAM que no contiene su marcador y Rolling Thunder 2 no expone RAM directa; en ambos se extraen regiones concretas del estado del núcleo privado. Salamander 2 usa el mismo mecanismo y aplica el orden de bytes dentro de su bloque de RAM, cuyo inicio no está alineado a cuatro bytes. El estado completo no se entrega al cliente. Se fijan tamaño y versión del formato. Los demás lectores preparados usan las regiones mínimas de RAM necesarias. Las muestras corruptas no deben afectar al otro puesto.

Las pruebas completas de Forgotten Worlds, 1944, TMNT, TwinBee, Rolling Thunder 2, Shinobi, Salamander 2 y ’88 Games usan dos cuentas, salas y bases SQLite temporales en `.cache/tests`. Verifican crédito/inicio, participación de ambos puestos, puntos reales, finalización al abandonar la sala y coincidencia de los resultados personales con el marcador público. Los informes se guardan en `output/playwright/*-score-verification.json`; no se mezclan con las partidas del propietario. Se capturaron también finales naturales y cambios de turno/ronda para los lectores que lo requieren.

Todas las pruebas del emulador se ejecutan con `ARCADE_TEST_MUTE_AUDIO=1`, que conserva el silencio de Chromium. No cambia el volumen de las partidas del propietario. Los mandos USB/Bluetooth y dos dispositivos físicos los probará el propietario; no se presenta la simulación de entradas como una prueba de ese hardware.

Copia previa al cierre de integración: `data/backups/arcade-2026-10-16T21-20-03-031Z.tar.gz`. Copia previa a la primera ampliación: `data/backups/arcade-2026-10-16T20-14-14-655Z.tar.gz`. ROMs y emulador se comprueban con `npm run integrity`; las copias de seguridad conservan base de datos, clave y archivos del chat.

Fuentes técnicas locales: DAT y drivers oficiales de FBNeo; definiciones de MAME 2003 Plus. La disponibilidad en MAME nativo actual no demuestra compatibilidad con los núcleos web instalados.

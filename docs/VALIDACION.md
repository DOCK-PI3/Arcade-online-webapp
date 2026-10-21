# Verificación de la primera implementación

## Preparación para Git y catálogo reproducible — 21 de octubre de 2026

Se añaden [PUBLICAR_EN_GIT.md](PUBLICAR_EN_GIT.md), [ROMS_COMPATIBLES.md](ROMS_COMPATIBLES.md), su CSV y `config/rom-requirements.json`: 46 juegos activos y dos BIOS, con nombres, dependencias, núcleos, romsets de referencia y SHA-256. Las fuentes locales comprobadas son FBNeo 1.0.0.3 (a2594cf), Arcade only Non-Merged, y MAME 0.287 merged. Las referencias enlazadas documentan los formatos; no se anuncian descargas verificadas de esos juegos comerciales.

El preparador cubre ahora los **48 ZIP** del catálogo distribuido, incluidos los cinco juegos base y Neo Geo, copia intactos los seis originales que lo necesitan y verifica el hash final antes de sustituir archivos. Se fija también la cabecera de plataforma de los ZIP reconstruidos para evitar diferencias de metadatos entre Windows y Linux. Se probaron las 48 preparaciones en un destino temporal y `roms:check` confirmó **48/48 aprobados**. Las colecciones originales y `data/` no se modificaron; el destino temporal se eliminó al terminar. Informe: `output/git-rom-rebuild-verification.json`.

`npm run roms:list` regenera los listados; `npm run roms:check` informa de archivos ausentes o incompatibles sin escribir en la carpeta. El importador directo protege también las BIOS frente a reemplazos por otros hashes. Se refuerzan `.gitignore` y `.dockerignore` para excluir ROMs, datos, secretos, dependencias, emuladores descargados y compilaciones. Una revisión con un repositorio Git temporal enumeró **245 archivos de fuentes y recursos**, sin archivos privados ni ROMs; listado en `output/git-source-inventory.txt`. No se ha inicializado ni publicado un repositorio real.

**118 pruebas Node aprobadas** y **6 pruebas Python aprobadas**, estas últimas con datos inventados, sin ROMs. Cubren metadatos actualizados, comprobaciones de archivos ausentes/incompatibles, protección de BIOS, exclusiones de Git, reconstrucción por CRC, cabeceras reproducibles, copia exacta de originales y conservación de archivos ante errores. La prueba de política HTTPS/WebSocket consulta una API para poder ejecutarse sin una build. `dist/` permanece eliminado; no se ha regenerado una compilación. La instalación completa en un equipo Linux nuevo sigue pendiente de comprobar allí.

## OutRunners: carreras individuales sin puntuación — 18 de octubre de 2026

Tras el aviso del propietario se comprobó que su ejecución solo tenía el puesto 1 y no había creado ningún resultado automático. El lector versión 1 exigía el modo nativo 3, correspondiente a la carrera enlazada; las carreras individuales pasan del modo 1 de selección al modo 2 de juego y quedaban excluidas. Además, el segundo puesto tiene su propio contador de tiempo cuando juega solo.

El lector **versión 2** admite juego individual en cualquiera de los puestos, utiliza el contador propio y comparte el contador únicamente en modo enlazado. La pantalla sin jugador y las demostraciones no puntúan. Se añadieron seis muestras auténticas de selección, carrera y cambio a etapa 1, tres por puesto. Las regresiones comprueban que los puestos sin jugador no se arman y que cambiar de etapa no termina la participación. Se conservan las pruebas anteriores de dos jugadores.

Una prueba completa con **una sola cuenta**, desde arranque limpio y crédito/inicio enviados por socket, alcanzó la etapa 1 después de la previa y terminó por agotarse el tiempo: publicó **1.720 tramos** automáticamente y concedió la medalla de primer puesto. No se cargaron estados guardados ni se escribió en RAM. Se usó una base temporal y audio silenciado. Informe: `output/playwright/orunners-solo-live-verification.json`. **114 pruebas aprobadas**. La partida fallida del propietario no dejó un recorrido guardado del que recuperar su marca; no se ha inventado ni añadido una puntuación.

Servidor reiniciado a las 21:05 UTC y salud local/HTTPS comprobada con certificado validado. Las huellas del historial permanecen iguales. Informe: `output/outrunners-solo-fix-release-verification.json`.

## Ampliación FBNeo — 18 de octubre de 2026

Se integran los **16 juegos aprobados**, con **37 puestos nativos**, controles particulares, marcadores automáticos y medallas de primer puesto. El catálogo queda en **46 juegos y 96 medallas**. Detalle de modalidades y reglas en [CATALOGO_FBNEO.md](CATALOGO_FBNEO.md). El propietario aprobó clasificar OutRunners por recorrido alcanzado; Kick Off registra goles. Se inicializan automáticamente AVSP para tres jugadores y NARC tras su configuración de fábrica; G.I. Joe usa cuatro puestos y Crazy Climber admite las dos palancas.

Los 16 informes `output/playwright/<juego>-release-verification.json` comprueban salas, cuentas y puertos, crédito/inicio, reproducción de estados auténticos en el núcleo, lectura privada de RAM, resultados finalizados en SQLite, marcador público y medalla del líder. Se observaron puntos positivos legítimos en todos los juegos; los ceros de otros puestos también son resultados válidos. Se añadieron **134 muestras reales**, con **272 muestras en total**. Las regresiones incluyen cuatro resultados de G.I. Joe, turnos de Frogger/Crazy Climber, reinicio de puntos entre combates de KOF ’98, goles de CPU excluidos de Kick Off y recorrido de OutRunners separado por piloto y excluido de sus demostraciones.

Las pruebas están silenciadas y usan bases temporales. Antes de activar las fichas se creó `data/backups/arcade-2026-10-18T20-31-13-016Z.tar.gz` y se guardaron huellas del historial. No se han descargado ROMs ni modificado las colecciones originales. La migración activa la ampliación una sola vez y respeta decisiones administrativas posteriores. El propietario realizará las partidas prolongadas con sus dispositivos y mandos.

**113 pruebas aprobadas**, compilación correcta e integridad de los **22 archivos del emulador y 49 ZIP**. Tras ampliar la cobertura de autorización se repitieron las 26 pruebas del servidor, todas correctas: solo se aceptan los ejes de cada juego, se conserva el puesto asignado y se rechazan valores analógicos manipulados y acciones reservadas. La interfaz se comprobó en Chromium con 46 marcadores, 96 medallas, la medalla ganada de OutRunners, unidades de recorrido en marcador/perfil y anchura de 390 px sin desbordamiento ni errores JavaScript.

Servidor reiniciado y verificado a las **20:37 UTC**: salud local correcta y salud HTTPS de la LAN con la CA validada; los 46 juegos anuncian ROM, motor y lector disponibles. Se compararon las huellas de usuarios, puntuaciones, salas, ejecuciones, puestos, participaciones, mensajes y amistades: todos permanecen idénticos a la copia previa. SQLite supera `quick_check` y claves externas. Informes finales: `output/fbneo-expansion-release-verification.json` y `output/playwright/fbneo-expansion-ui-verification.json`.

## Medallas propias — 18 de octubre de 2026

Se sustituye la integración de consulta externa por **50 medallas generales y una de primer puesto por cada juego activo**: **80 en esta entrega inicial**. El propietario eligió esta distribución; habrá 100 al llegar a 50 juegos. Catálogo y reglas en [MEDALLAS.md](MEDALLAS.md). Se retiran el formulario, las consultas externas, el código de normalización/cifrado ya innecesario y el permiso de imágenes externas. Las rutas antiguas responden 410 y la migración borra únicamente sus credenciales y caché de la base activa, conservando sus columnas por compatibilidad.

El servidor concede medallas con evidencias propias: puntuaciones automáticas, salas, mensajes, amistades y preferencias válidas. Los resultados en curso no cuentan como envíos finalizados; recargas y reintentos no duplican progreso. El primer puesto usa exactamente el desempate del marcador público. Se conservan las medallas ganadas al ser superado, cambiar el catálogo o retirar un juego. La activación recupera de una vez el historial comprobable y los actuales líderes antes de que se pierdan esas posiciones.

**87 pruebas aprobadas**, incluida la nueva cobertura de umbrales 1/20/50/100, progreso del catálogo, empates, conservación, migración, privacidad, notificaciones y medallas de futuros juegos. Compilación correcta. Se comprobaron en Chromium las 80 imágenes SVG, concesión automática al crear una sala, filtros, búsqueda, detalles con Escape/cierre, apariencia oscura, cierre de sesión y anchuras de 390 y 768 px sin desbordamiento ni errores JavaScript. Informe: `output/playwright/medals-ui-verification.json`; capturas `medals-{desktop,desktop-dark,mobile,tablet,detail,mobile-detail}.png`.

Una partida completa de Columns con Android simulado y controles táctiles, silenciada, registró **10.222 puntos** y concedió automáticamente las medallas de primera partida, puntuación final y primer puesto antes de abrir la vitrina. Se comprobó que el marcador público coincidía y no hubo controles rechazados. Informe: `output/playwright/medals-live-verification.json`. Se utilizaron exclusivamente cuentas y bases temporales para estas pruebas. La instalación activa se protege con una copia previa y una comparación de huellas del historial antes/después de la migración; informe `output/release-medals-verification.json`.

Este cambio sustituye las referencias a RetroAchievements de las verificaciones históricas siguientes.

## Columns: final prematuro durante el juego — 17 de octubre de 2026

Tras el aviso del propietario en Android se reprodujo un cambio nativo de la bandera de participación de `0x01` a `0x07`. El lector comparaba el byte completo con uno y cerraba la participación aunque siguiera activa. El lector versión 2 comprueba el bit de participación y excluye los estados terminales; permite los demás bits que utiliza Columns durante el juego. Se mantienen las comprobaciones de puntuación binaria/BCD y la finalización independiente de cada puesto.

Las cuatro capturas reales de esa secuencia están en `tests/fixtures/columns-state-transitions.json`. Las pruebas comprueban los dos puestos, las combinaciones de bits, la aceptación de controles después del estado `0x07`, el rechazo después del final real y un único guardado final. **76 pruebas aprobadas**. La corrección afecta al lector del servidor y requiere reiniciarlo.

Una partida completa con Chromium en modo Android y controles táctiles reales del reproductor pasó por los estados `0x01`, `0x11`, `0x07` y el final `0x86`. Se comprobaron controles aceptados durante las banderas de juego, ausencia de cierres anticipados y publicación automática de **140 puntos** al perder de verdad. No hubo entradas rechazadas ni errores de JavaScript. Se usaron cuenta/base temporales y sonido silenciado; informe `output/playwright/columns-mobile-lifecycle-verification.json`. El móvil físico queda para la comprobación del propietario. Servidor reiniciado y salud HTTPS de la LAN verificada con la misma CA.

## Android: controles táctiles y sonido — 17 de octubre de 2026

El reproductor detecta móviles/tablets Android y pantallas con entrada táctil principal. Muestra cruceta de ocho direcciones, A/B/C/D, Crédito e Inicio. Admite varios dedos, deslizamiento, ocultación manual y liberación al cancelar un toque, perder captura/foco o cerrar el reproductor. Comparte la propiedad de cada pulsación con teclado y mando, de modo que soltar un método no libera otro que siga pulsado. Se conservan las asignaciones específicas de cada juego y la autorización del puesto por el servidor.

Se añade «Jugar con sonido» y activación síncrona desde un gesto dentro del reproductor. Si el navegador bloquea el audio, se mantiene el vídeo silenciado y se ofrece reintentar; silenciar manualmente se respeta al seguir jugando o recibir otra pista. La sala reserva altura para los controles. En pantalla completa horizontal se sitúan a los lados de la imagen.

La captura inicial del emulador podía quedar conectada a un nodo que OpenAL había reorganizado: había sonido en el motor, pero no salían paquetes de audio. El adaptador propio mantiene el destino de captura y restaura sus conexiones, incluyendo fuentes creadas o sustituidas después del arranque. No se modifican los archivos fijados de EmulatorJS ni su manifiesto.

Se aprobaron **74 pruebas**, incluidas propiedad compartida de botones, diagonales, deslizamiento, cancelación, bloqueo/reintento de audio, silencio voluntario y restauración de las conexiones de OpenAL. Compilación de producción e integridad de los 22 archivos del emulador y 33 ZIP correctas. Las pruebas de los 13 casos afectados se repitieron después del ajuste final de captura.

Las pruebas completas de **Columns (FBNeo) y Salamander 2 (MAME 2003 Plus)** usaron un navegador Chromium con Android, pantalla táctil y viewport móvil simulados y una segunda cuenta con teclado en PC. Verificaron pulsaciones simultáneas de diagonal y acción en el puesto 1, liberaciones, Crédito/Inicio y dirección en el puesto 2. Se comprobó ausencia de desbordamiento a 320/800 px y pantalla completa a 844×390. En ambos núcleos el navegador recibió y decodificó audio con energía distinta de cero, con el vídeo reproduciéndose y sin silencio. Informes: `output/playwright/android-live-verification.json` y `android-salmndr2-verification.json`; capturas de la última comprobación: `android-salmndr2-{portrait,tablet,landscape}.png`.

Todas las cuentas y partidas de estas pruebas usan bases temporales. En las mediciones de audio se sustituyó el silenciamiento global de Chromium por salidas de ganancia cero para mantener el procesamiento de sonido sin emitirlo por los altavoces. Las comprobaciones simulan Android; la escucha y los toques en un móvil/tablet físico corresponden a la prueba del propietario. La instalación del certificado HTTPS de la LAN sigue siendo necesaria.

El ajuste visual final coloca también Crédito e Inicio en los laterales en horizontal. Una vista de prueba con vídeo sintético confirmó que ninguno de los dos botones ocupa la región del vídeo y que no hay desbordamiento a 844 px; captura `output/playwright/android-layout-landscape.png`. Se verificó asimismo la liberación del botón virtual con Enter aunque el foco salga de su panel antes de soltar la tecla.

## Instaladores y arranque del 17 de octubre de 2026

Se añadieron `Instalar-Windows.cmd`, `Iniciar-Windows.cmd`, `instalar-linux.sh` e `iniciar-linux.sh`. `Iniciar-red.cmd` delega en el nuevo iniciador de Windows. El instalador común conserva datos y configuración, reutiliza el emulador si supera sus hashes, prepara dependencias, Chromium y web, y comprueba el arranque de Chromium con sandbox y sin sonido.

Se verificaron la sintaxis PowerShell/Bash/JavaScript, el comprobador real de la instalación Windows y el rechazo de reinstalación con el servidor activo, antes de ejecutar `npm ci`. En carpetas aisladas con espacios en la ruta se probaron en Windows y Ubuntu/WSL las descargas reales de Node 24.15.0, su SHA-256 fijado, la extracción, npm 11.12.1, la reutilización del Node local y la entrega de argumentos al instalador y al iniciador. En estas pruebas los puntos de entrada de la aplicación se sustituyeron por un registrador: no instalaron paquetes del sistema ni escribieron en la base real. Los registros están en `output/installer-{windows,linux}-bootstrap-verification.json`. La instalación completa de paquetes de Chromium y el juego nativo en Linux siguen pendientes en el servidor de destino.

## Separación del catálogo en administración

El catálogo, su botón «Añadir juego» y los formularios de alta/edición se muestran únicamente en la pestaña «Juegos». «Actualizar» también renueva la lista de juegos. La comprobación con Chromium y una base temporal verificó la separación respecto a «Usuarios» y «Servidor», apertura y cierre de ambos formularios, actualización y ausencia de desbordamiento a 390 px. No hubo errores de JavaScript y la compilación de producción fue correcta. Informe: `output/playwright/admin-tabs-verification.json`.

## Cierre de integración del 16 de octubre de 2026

- Se completan **’88 Games, Shinobi y Salamander 2**: el catálogo queda con **30 juegos activos**, todos con dos puestos y lector automático aprobado. Tecmo World Cup ’98 queda retirado; se conserva cualquier historial anterior. Esta actualización sustituye las limitaciones de la ampliación inicial descrita más abajo.
- **68 pruebas aprobadas**, compilación de producción correcta e integridad comprobada de **22 archivos del emulador y 33 ZIP**. Las fixtures contienen **138 capturas de memoria para los 25 juegos añadidos**, incluidos cambios de turno, disciplinas, participación y finalización de los tres últimos.
- Pruebas completas con dos cuentas en bases temporales: Shinobi **100/0**, Salamander 2 **1.900/3.200** y ’88 Games **1.946/1.946**. En ’88 Games se comprobó el fin natural de ambos participantes y el guardado automático antes de abandonar la sala. Los resultados personales y públicos coincidieron con el motor. Informes en `output/playwright/{shinobi,salmndr2,88games}-score-verification.json`.
- Shinobi selecciona los bancos según el turno y mantiene la identidad de cada marcador. Salamander 2 interpreta unidades de cien puntos dentro del bloque privado de RAM. ’88 Games usa la puntuación acumulada original por atleta, conservándola entre disciplinas; A/B alternan carrera y C sirve para salto, acción e iniciales.
- La reconstrucción de Salamander 2 y su BIOS Konami GX produjo exactamente los hashes aprobados; también se reconstruyó 1942 como comprobación del conversor existente. Los archivos originales del propietario permanecen intactos.
- Todas las pruebas de emulación se hicieron sin sonido (`ARCADE_TEST_MUTE_AUDIO=1`) y sin publicar cuentas o partidas de QA en la base real. Los mandos y dos dispositivos físicos siguen correspondiendo a las pruebas del propietario.
- Copia anterior a la activación: `data/backups/arcade-2026-10-16T21-20-03-031Z.tar.gz`.
- Servidor reiniciado y verificado a las **21:24 UTC**: salud correcta, **30 fichas activas** con ROM, emulador, lector e imagen disponibles, cinco participaciones recientes y acceso LAN por HTTPS con certificado validado. SQLite supera integridad y claves externas; se conservan las dos cuentas y los cuatro resultados automáticos reales. Informe actualizado: `output/release-verification.json`.

## Ampliación MAME del 16 de octubre de 2026

- Se incorporan **22 juegos nuevos activos**, además de los cinco anteriores: **27 en total**, todos con lector automático aprobado. La lista y las cuatro limitaciones restantes están en [CATALOGO_MAME.md](CATALOGO_MAME.md). Se respetan las retiradas solicitadas de `frogwld`, `spaceinv` y `supgoal`.
- **62 pruebas aprobadas**; compilación de producción correcta. Integridad correcta de **22 archivos del emulador y 33 ZIP**. Hay **117 muestras de memoria para los 22 juegos nuevos**, con puntuaciones independientes, turnos/rondas y estados de participación. Las muestras de calibración de la última vida de Rolling Thunder 2 se identifican expresamente: se fijaron cero vidas extra en un motor privado y se observó después la muerte; no se publicaron esos resultados.
- Pruebas completas con dos cuentas en bases temporales: Forgotten Worlds **300/100**, 1944 **660/870**, TwinBee **50/50**, TMNT **0/1** y Rolling Thunder 2 **0/800**. Los valores son los que generó el bot, incluidos los ceros legítimos. En todos los casos se comprobó participación de ambos puestos, guardado y coincidencia del marcador público con los máximos observados por el servidor al salir de la sala. Los informes están en `output/playwright/<juego>-score-verification.json`.
- Se corrigieron controles rotatorios de Forgotten Worlds, inicio de dos participantes en máquinas que lo requieren, créditos compartidos de algunos modelos e inicialización previa de Rolling Thunder 2. Se contemplan la última vida de Darius y TMNT y el borrado de puntos al morir en máquinas que reutilizan esos campos. 1944 y Rolling Thunder 2 se leen desde el estado privado con tamaño y hash fijados.
- Las pruebas de emulación están silenciadas mediante `ARCADE_TEST_MUTE_AUDIO=1`. No se modifica el sonido de las partidas normales ni se añaden controles táctiles. La prueba con mandos físicos y dos equipos corresponde al propietario.
- Se creó la copia `data/backups/arcade-2026-10-16T20-14-14-655Z.tar.gz` antes de insertar las nuevas fichas en la base del propietario.
- Servidor reiniciado y comprobado a las 20:25 UTC: `/api/health` correcto, 27 fichas activas con ROM, imágenes, emulador y puntuación disponibles, cinco participaciones recientes visibles y acceso HTTPS por LAN con certificado validado. SQLite supera `quick_check` y la comprobación de claves externas. Informe: `output/release-verification.json`.

## Actualización del 16 de octubre de 2026

- El propietario confirmó la conexión desde su móvil por la misma red y el acceso a una partida. El dispositivo objetivo sigue siendo PC o tablet con teclado o mando USB/Bluetooth; no se requieren controles táctiles.
- Columns (World), Sega, 1990, sustituye a Tetris en el catálogo activo. El ZIP procede de la colección local FBNeo del propietario. Se desactiva la ficha anterior y se cierran sus salas antiguas, conservando usuarios e historial. La migración solo se ejecuta una vez y respeta cambios administrativos posteriores.
- Se arrancó Columns con el núcleo web instalado en una instancia privada de prueba, sin cuentas ni registros de partidas reales. Ambos puestos aceptaron crédito e inicio y mostraron tableros activos simultáneamente; se comprobó la entrada independiente del primer puesto. Captura del catálogo: `public/games/columns.png`. Esto no sustituye una partida completa entre dos dispositivos físicos.
- El lector automático de Columns se implementó después del aviso del propietario sobre resultados ausentes. Lee 20 bytes por consulta dentro de los 201.032 bytes expuestos por el núcleo, contrasta las copias binaria y BCD y distingue los estados de cada puesto. Admite puntuaciones iniciales con bonificación y conserva los últimos puntos cuando el fin de partida ocurre entre consultas. No se reutiliza el lector de Tetris.
- La prueba completa posterior utilizó dos cuentas en `.cache/tests/columns-live-Dxunrm`, sin escribir partidas ni resultados en la base del propietario. El motor mostró 63 y 20.156 puntos al finalizar; ambas cuentas recibieron exactamente esas puntuaciones en el marcador público y en sus resultados personales, con estado finalizado. Pruebas guardadas en `output/playwright/columns-score-verification.json` y `columns-score-live-finished.png`.
- `npm test`: **33 pruebas aprobadas**. Incluye la migración del catálogo y conservación del historial, nueve muestras reales de memoria de Columns, rechazo de puntuaciones corruptas y finalización independiente entre consultas. `npm run build` del cambio de catálogo y `npm run integrity` correctos: 20 archivos del emulador y siete ZIP conservados, incluido el Tetris retirado. La corrección del lector solo cambia código del servidor.
- Antes de aplicar el cambio se creó `data/backups/arcade-2026-10-16T14-17-09-787Z.tar.gz`.

Fecha: 15 de octubre de 2026. Entorno de desarrollo Windows, Node.js 24.15.0 y Chromium mediante Playwright. Las cuentas y salas de QA están en una base separada, dentro de `.cache`. Los datos reales del propietario se conservan; se creó una copia antes de actualizar el servidor.

## Automatización

- `npm test`: **30 pruebas aprobadas**, sin fallos.
- `npm run build`: compilación de producción correcta.
- `npm run integrity`: correctos los hashes de los 20 archivos de EmulatorJS/FBNeo y de los seis ZIP importados.
- `npm audit --omit=dev`: ninguna vulnerabilidad conocida notificada en las dependencias de producción en el momento de la consulta.

Las pruebas cubren cuentas, hash de contraseñas, sesiones, antispam básico, CSRF, origen, permisos administrativos, salas privadas, invitaciones revocadas y de un uso, amistad mutua, puestos concurrentes, límites de cuatro puestos, rechazo de controles de otros puertos, imágenes del chat, rechazo de puntuaciones manuales, cifrado de claves, cierre de registros, protección del último administrador, copia/restauración, archivos modificados, suspensión, salida de sesión y cambio de contraseña.

El panel personal se prueba con datos de dos cuentas: aislamiento, deduplicación de participaciones, mejores marcas automáticas y exclusión de resultados manuales antiguos. También se comprueba la persistencia de apariencia por cuenta y el rechazo de preferencias inválidas. Una respuesta simulada con la estructura documentada de RetroAchievements comprueba normalización, orden de logros, caché, recuperación sin conexión y borrado de claves/datos. No sustituye una consulta con credenciales reales.

Las pruebas del motor usan un sustituto controlado para comprobar permisos, rechazo de ROMs al cliente, rechazo de eventos de anfitrión y asignación de controles al puesto autorizado. Las pruebas unitarias comprueban límites de motores, créditos, inicios e identidad. Los cinco lectores usan fragmentos de RAM capturados previamente; no arrancan juegos ni demuestran todos los estados de fin de partida.

La corrección del reproductor añade pruebas de pulsaciones breves dentro de un mismo fotograma, disparos repetidos, separación de puestos, descarte de entradas al liberar el puesto y envío ordenado por lotes al motor. Los lectores producen los mismos resultados con las regiones mínimas de RAM (menos de 32 bytes por lectura) que con las muestras completas.

En un iframe con vídeo sintético por WebRTC se verificaron activación y silencio, volumen al 35%, entrada y salida de pantalla completa, devolución del foco al vídeo y ausencia de movimientos al usar el deslizador de volumen. Una tecla repetida del botón B genera una pulsación y una liberación. Se observaron 60 fps en esa transmisión sintética; no se presenta como medida de rendimiento de los juegos. La revisión móvil a 390 px no mostró desbordamiento horizontal. Capturas: `player-fullscreen.png` y `player-controls-mobile.png`.

La restauración se ejecutó con una copia real de la base de pruebas en una carpeta nueva: SQLite comprobó su integridad, se conservaron las cuentas y se eliminaron las sesiones. También se comprobó que no sobrescribe un destino existente.

## Red local y mandos (16 de octubre de 2026)

Se verificaron escucha HTTPS en 192.168.0.22:443, página de preparación en 192.168.0.22:3000, backend en loopback y API del proxy solo en 127.0.0.1:2020. El cliente HTTPS de Node validó la cadena con la CA generada, sin ignorar errores TLS; salud y descarga del certificado respondieron 200 y el certificado publicado coincidió con el de la autoridad. Se aplicaron y comprobaron reglas de firewall con perfil privado y origen LocalSubnet para Caddy y Chromium.

Las pruebas añadidas cubren permisos administrativos sobre red, rechazo de IPs ajenas al equipo, dominios con rutas o saltos de línea, puertos reservados, cookies Secure y CSP de WebSocket detrás de un proxy HTTPS confiable. El guardado de ajustes de mando se comprueba por cuenta. La detección tolera puertos vacíos, encuentra un mando estándar en otro índice y libera pulsaciones al perder foco o desconectarse.

En navegador y cuenta de QA se detectó un mando simulado en el índice 2, se capturó el botón 5 y se verificó su guardado. Se revisaron el panel de red y su guardado, con anchura móvil de 390 px sin desbordamiento. El reproductor compilado se revisó con una sala simulada sin ROM: controles nativos activados, barra visible antes de recibir vídeo y fondo del motor oculto. No se ha conectado físicamente el mando del propietario ni el Android desde las herramientas; esas pruebas siguen siendo suyas. Tampoco se ha publicado un dominio ni validado acceso desde Internet.

## Historial de juegos

Las comprobaciones jugables siguientes se realizaron antes de la última petición del propietario. La transmisión entre dos navegadores corresponde al diseño anterior de emulación en el navegador anfitrión. El motor privado de Chromium del servidor también se arrancó para obtener muestras de memoria y capturas, pero esto no acredita una sesión completa del nuevo flujo integrado. A petición del propietario, no se continuaron las pruebas reales de juegos y puntuaciones.

Se importaron exclusivamente los ZIP iniciales desde la colección FBNeo aportada en D:, conservando los originales.

| Juego        | Comprobación                                                                      |
| ------------ | --------------------------------------------------------------------------------- |
| Tetris, Sega | Arranque y pantalla real del juego; núcleo avanzando fotogramas                   |
| Contra       | Autotest completado y pantalla de inicio                                          |
| Metal Slug   | BIOS Neo Geo cargada como ZIP intacto y pantalla real; transmisión a otro usuario |
| Metal Slug 2 | BIOS cargada y pantalla del título tras más de 1200 fotogramas                    |
| 1941         | Autotest de memoria y pantalla de advertencia inicial del juego                   |

Se corrigieron dos fallos del adaptador durante estas pruebas: el mapa de controles debía definir los cuatro puertos y la BIOS Neo Geo tenía que mantenerse como ZIP. Se configuró salida de color de 16 bits y WebGL 2 para resolver la transparencia incorrecta observada en FBNeo.

Entre dos contextos aislados y dos cuentas diferentes se verificó vídeo no vacío, pistas de vídeo y audio activas y llegada de las teclas de crédito/inicio al puerto del segundo jugador. Esta prueba comprueba el puente entre navegadores, no una sesión prolongada ni su latencia en equipos físicos separados. No se han conectado mandos físicos.

La portada se revisó a 1280 px y 390 px; a 390 px el ancho del documento coincide con el viewport, sin desbordamiento horizontal. Se revisaron el registro, la creación de salas y las pantallas del administrador y usuarios. Capturas locales en `output/playwright/`.

El panel personal ampliado se revisó a 1280 px y 390 px, con sus estadísticas, historial, opciones de cuenta y aviso de límites de RetroAchievements. Se comprobó el selector de apariencia, la persistencia del modo oscuro tras recargar y la carga correcta de las cinco capturas reales del catálogo. En móvil el ancho del documento es de 390 px, sin desbordamiento. Capturas adicionales: `profile-dark.png`, `home-dark.png` y `home-dark-mobile.png`.

## Límites de lo verificado

- No se ha ejecutado Docker ni se ha desplegado en el Ubuntu del propietario: Docker no está disponible en este equipo de trabajo.
- No se han configurado certificados ni probado clientes físicos de la LAN.
- No se ha probado multijugador desde redes distintas ni TURN.
- El máximo de cuatro puestos está probado con una fixture de autorización, no con una partida real de cuatro jugadores.
- La integración de consulta de RetroAchievements no se ha probado con una cuenta y clave reales.
- Desbloquear logros nuevos queda fuera del alcance acordado. La configuración explica que la integración de RetroAchievements solo consulta el perfil.
- No se ha realizado una auditoría independiente ni una prueba de carga prolongada.
- El propietario realizará partidas completas para validar puntuación, identidad, fin de partida y transmisión en el nuevo motor del servidor. La persistencia de .hi/NVRAM e iniciales no está implementada; sí el marcador web por cuenta.

Los mensajes internos del núcleo relativos a la lista de juegos o a dimensiones iniciales no impidieron el arranque observado. No se confunde `started=true` con compatibilidad: las pantallas de error de BIOS se detectaron mediante revisión visual y se repitieron después de corregirlas.

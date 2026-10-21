# Salón Arcade

Comunidad arcade en español con cuentas, amigos, salas y juegos desde el navegador. Servidor Node.js + SQLite, interfaz React, FBNeo y MAME 2003 Plus mediante EmulatorJS 4.2.3 en Chromium del servidor. Nombre provisional.

Para publicar o instalar desde un clon nuevo, consulta [qué subir a Git y cómo preparar la instalación](docs/PUBLICAR_EN_GIT.md). El repositorio no incluye juegos, BIOS, cuentas ni datos locales. [Lista completa de 46 juegos y 2 BIOS, versiones de romset y rutas](docs/ROMS_COMPATIBLES.md) · [Listado CSV con hashes](docs/ROMS_COMPATIBLES.csv). Tras aportar los ZIP preparados, `npm run roms:check` debe mostrar **48/48 aprobados**.

## Abrir en este ordenador

### Instalación y arranque con scripts

Ejecuta los scripts desde la carpeta del proyecto. Buscan Node.js 24.15 o posterior de la rama 24; si falta, los instaladores descargan **Node 24.15.0** desde nodejs.org, comprueban su SHA-256 y lo guardan en `.cache/node`, sin cambiar la instalación global.

| Sistema | Instalar una vez | Arrancar |
| --- | --- | --- |
| Windows x64 | Doble clic en `Instalar-Windows.cmd` | Doble clic en `Iniciar-Windows.cmd` |
| Linux x64 / ARM64 | `bash instalar-linux.sh` | `bash iniciar-linux.sh` |

Los instaladores preparan los paquetes npm, EmulatorJS/FBNeo/MAME, Chromium del servidor y la web compilada. En Windows instalan también Caddy para la LAN; en Linux instalan las bibliotecas del sistema de Chromium y pueden pedir `sudo` para ese paso. Ejecuta Linux con un usuario normal. Se requiere Internet para la instalación. Conservan `.env`, cuentas, partidas y ROMs; no descargan juegos ni BIOS. Detén el servidor antes de volver a instalar: el instalador rechaza los puertos ocupados para evitar reemplazar dependencias en uso.

Windows arranca con el acceso LAN/HTTPS configurado; `Iniciar-red.cmd` sigue funcionando como acceso al mismo iniciador. Para trabajar únicamente en este PC usa `Iniciar-Windows.cmd -LocalOnly`. Linux arranca en `http://127.0.0.1:3000` y respeta `.env`; el acceso de otros equipos requiere el proxy HTTPS descrito en [INSTALACION.md](docs/INSTALACION.md). Mantén abierta la consola; detén con **Ctrl+C**.

Para comprobar una instalación sin modificarla usa `Instalar-Windows.cmd -Check` o `bash instalar-linux.sh --check`. Si las bibliotecas de Chromium ya están preparadas en Linux, `bash instalar-linux.sh --skip-system-deps` omite su instalación. Si falta curl/wget, tar, xz o certificados del sistema, el instalador indica los paquetes básicos necesarios. Copia el proyecto entre sistemas **sin `node_modules` ni `.cache`** y ejecuta el instalador del destino.

### Comandos manuales

Necesitas Node.js 24.15 o posterior de la rama 24.

```powershell
npm.cmd ci
npm.cmd run emulator:install
npm.cmd run server:install
npm.cmd run build
npm.cmd start
```

Abre **http://127.0.0.1:3000**. Una instalación desde Git debe aportar las ROMs por separado en `data/roms`, siguiendo [la guía de preparación](docs/PUBLICAR_EN_GIT.md); los instaladores no descargan juegos ni BIOS. En una instalación existente no es necesario repetir la preparación de los ZIP ya aprobados.

Al crear la primera cuenta se solicita el código de instalación que muestra la consola. También está en `data/setup-code`. Esa cuenta será administradora; las siguientes serán miembros. No hay contraseñas predefinidas. El panel se abre desde **Administración**, al pie de la página, o en `/#/admin`.

El servidor escucha en loopback por defecto. Para usarlo desde otros equipos de la LAN, sigue [la instalación en Linux y HTTPS](docs/INSTALACION.md); cambiar únicamente la escucha a `0.0.0.0` no basta para las funciones de juego que necesitan un contexto seguro.

## Qué incluye

Para probar desde móviles y otros equipos de este Windows, abre **Iniciar-red.cmd**. La preparación de Android está en **http://192.168.0.22:3000** y la comunidad en **https://192.168.0.22** una vez instalado su certificado local. **Administración → Red y acceso** permite cambiar IP, puerto y dominio. Consulta [los pasos de red local](docs/RED_WINDOWS.md). `npm start` conserva el modo de desarrollo en loopback.

| Función                                                              | Estado                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Registro abierto, antispam básico y primer administrador con código  | Implementado                                                    |
| Contraseñas con scrypt, sesiones HttpOnly y protección de peticiones | Implementado y probado                                          |
| Amigos y solicitudes aceptadas por ambas partes                      | Implementado y probado                                          |
| Salas públicas, de amigos y por invitación                           | Implementado y probado                                          |
| Invitaciones revocables, de un uso y con caducidad                   | Implementado y probado                                          |
| Hasta cuatro puestos, respetando el máximo de cada juego             | Implementado; G.I. Joe con cuatro puestos comprobados en el motor |
| Miembros adicionales solo en el chat                                 | Implementado; no reciben controles ni vídeo                     |
| Chat con imágenes, enlaces y vídeos de YouTube/Vimeo                 | Implementado                                                    |
| Marcadores por juego con lectura automática de RAM en el servidor    | Implementado; validación jugable por el propietario             |
| Controles personales de teclado y mandos estándar                    | Implementado                                                    |
| Medallas propias: 50 retos del salón y una por juego | Implementado; vitrina personal con progreso e imágenes |
| Capturas reales del catálogo y temas claro, oscuro y del sistema     | Implementado; apariencia guardada por usuario                   |
| Panel de usuarios, salas, moderación, registros, catálogo y copias   | Implementado                                                    |
| Despliegue Linux con Docker y proxy HTTPS local                      | Preparado; pendiente ejecutar en el servidor del propietario    |
| Multijugador entre redes de Internet                                 | Pendiente de STUN/TURN y validación externa                     |

## Medallas del salón

Entra en **Tu perfil → Mis medallas**. Hay **50 medallas generales y una de primer puesto por cada juego activo**: 96 con los 46 juegos actuales y 100 al llegar a 50 juegos. Incluyen 1/20/50/100 puntuaciones automáticas, primera partida, medio catálogo, catálogo completo, salas, amistades y personalización. Se conceden en el servidor, tienen insignias SVG propias y se conservan al ser superadas o retirarse un juego. No necesitas una cuenta externa. Consulta [el catálogo de medallas y sus reglas](docs/MEDALLAS.md).

## Cómo funciona una partida

Cada sala activa ejecuta su motor en una instancia aislada de Chromium del servidor. Los jugadores reciben vídeo y audio por WebRTC y envían controles; el servidor asigna y comprueba su puesto. Los miembros sin puesto siguen en el chat. No se aceptan puntuaciones, capturas de resultado ni archivos de récords enviados por clientes.

Cada participación admite un crédito y un inicio. Al terminar o desconectarse se conserva la mejor puntuación observada cuando el juego tiene un lector validado. El anfitrión puede usar **Preparar nueva partida** para que todos reconecten. En Columns cada jugador inserta su crédito, pulsa Inicio y elige nivel con su botón de acción. Las partidas sin conexiones se cierran tras un minuto y tienen una duración máxima de dos horas.

El máximo predeterminado es de dos motores simultáneos (`MAX_SERVER_GAMES`, de 1 a 8). El primer arranque puede tardar varias decenas de segundos. Los lectores están ligados a los ZIP y al núcleo fijados; un juego nuevo necesita su lector y validación. Los marcadores web persisten en SQLite. La persistencia de tablas internas `.hi`/NVRAM y la extracción de iniciales no forman parte de esta integración: la identidad del marcador es la cuenta del jugador.

La barra del reproductor permite activar/silenciar sonido, ajustar volumen y entrar/salir de pantalla completa. Haz clic en la imagen para devolver el teclado al juego. **Conexión** muestra FPS de vídeo recibido, ida/vuelta de red y búfer cuando el navegador proporciona estas medidas; la cifra de red no mide el retraso completo del control hasta la imagen. La transmisión prioriza fotogramas y pide un búfer bajo, sujeto a lo que permita cada navegador.

El vídeo tiene también los controles nativos del navegador. La barra alternativa aparece desde el inicio de la conexión. En **Perfil → Mando USB o Bluetooth** puedes detectar y reasignar botones, guardar el mapa o restablecer Xbox. El stick izquierdo se mantiene para movimiento; la configuración se aplica al reabrir la partida. Al llegar el vídeo se da el foco al juego; al ir al chat o a otra ventana se liberan los controles.

Se han comprobado los puestos nativos y el circuito de puntuación, marcador y medalla de los 16 juegos de la [ampliación FBNeo](docs/CATALOGO_FBNEO.md), incluido G.I. Joe con cuatro puestos. Las pruebas usan el motor real y reproducción de estados auténticos en bases de datos privadas. El propietario comprobará partidas completas con sus dispositivos y mandos; siguen pendientes el rendimiento y la instalación en el Linux de destino.

## Catálogo

Hay **46 juegos activos**. La ampliación del 18 de octubre incorpora 16 juegos de FBNeo con sus puestos, controles, lectores y medallas: consulta [la lista y sus reglas](docs/CATALOGO_FBNEO.md). Kick Off clasifica por goles; OutRunners, por recorrido alcanzado, según la decisión del propietario.

| Juego                | ZIP           | BIOS         | Puestos |
| -------------------- | ------------- | ------------ | ------- |
| Columns (World)      | `columns.zip` | —            | 2       |
| Contra               | `contra.zip`  | —            | 2       |
| Metal Slug           | `mslug.zip`   | `neogeo.zip` | 2       |
| Metal Slug 2         | `mslug2.zip`  | `neogeo.zip` | 2       |
| 1941: Counter Attack | `1941.zip`    | —            | 2       |

Los archivos proceden de la colección FBNeo 1.0.0.3 (a2594cf) aportada por el propietario, sin modificar los originales. El núcleo web está fijado por separado. La ampliación con ROMs de MAME y su validación está en [CATALOGO_MAME.md](docs/CATALOGO_MAME.md). Columns sustituye al Tetris de Sega en el catálogo activo desde el 16 de octubre de 2026; la ficha anterior y su historial se conservan desactivados. Columns admite dos jugadores simultáneos y registra automáticamente la puntuación de cada puesto al terminar su participación, incluidos los puntos iniciales de los niveles medio y difícil. Para aplicar la corrección del lector a una sala que ya estaba abierta, el anfitrión debe preparar una nueva partida.

La aplicación permite jugar desde PC y desde móviles y tablets Android. En dispositivos táctiles aparecen automáticamente una cruceta con diagonales, botones A/B/C/D y Crédito/Inicio. Admiten varios dedos a la vez y respetan las asignaciones particulares de cada juego. «Ocultar controles» permite usar un mando USB/Bluetooth; en PC permanecen ocultos y se pueden mostrar desde «Controles táctiles».

En Android entra por la dirección HTTPS de la LAN y conecta a una partida. Toca «Jugar con sonido» o un control del juego para autorizar el audio; el silencio elegido manualmente se respeta. Para aprovechar la pantalla gira el dispositivo y pulsa «Pantalla completa»: los controles quedan a ambos lados de la imagen. La página de la sala adapta su altura al activar el panel táctil. La instalación del certificado local se explica en [RED_WINDOWS.md](docs/RED_WINDOWS.md).

```powershell
npm.cmd run roms:import -- "D:\FinalBurn Neo 1.0.0.3 (a2594cf) (Arcade only) (Non-Merged)\Roms"
npm.cmd run integrity
```

El importador conserva el manifiesto previo, genera hashes SHA-256 y evita sustituir un ZIP de juego o BIOS por otro incompatible. Para un clon nuevo, `scripts/prepare-catalog-roms.py` prepara los 48 ZIP desde las colecciones locales indicadas y comprueba sus hashes antes de instalarlos: [procedimiento completo](docs/PUBLICAR_EN_GIT.md). `npm run roms:list` regenera la lista publicada y `npm run roms:check` comprueba los archivos requeridos. El panel permite añadir fichas de juegos; sus ZIP y BIOS se copian en `data/roms`. Los datos y ROMs quedan fuera del control de versiones y de la imagen Docker.

## Desarrollo y comprobaciones

Para actualizar la lista pública de ROMs usa `npm run roms:list`; `npm run roms:check` comprueba los ZIP de esta instalación. Las pruebas del preparador se ejecutan con `python tests/prepare_roms_test.py` (o `python3` en Linux), con Python 3.11 o posterior y datos inventados.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run integrity
```

Para desarrollo: ejecuta `npm.cmd run dev` y, en otra terminal, `npm.cmd run dev:web`. Tras instalar o cambiar archivos del emulador, reinicia el servidor para volver a comprobar los hashes.

Consulta [el alcance acordado](docs/PROYECTO.md), [seguridad y límites](docs/SEGURIDAD.md), [instalación y restauración](docs/INSTALACION.md) y [las verificaciones realizadas](docs/VALIDACION.md).

# instalar desde un clon de Git


## Qué debe obtener quien lo instale

El repositorio incluye **código y metadatos**, no juegos ni BIOS. La lista completa está en [ROMS_COMPATIBLES.md](ROMS_COMPATIBLES.md), con una [versión CSV](ROMS_COMPATIBLES.csv) y `config/rom-requirements.json` para herramientas.

Las colecciones locales utilizadas para preparar esta instalación son:

1. **FinalBurn Neo 1.0.0.3 (a2594cf) — Arcade only, Non-Merged**.
2. **MAME 0.287 ROMs — merged**.

Cada instalación aporta copias de los archivos que pueda utilizar. No hay descarga automática de ROMs ni una URL de descarga de estos juegos incluida en el proyecto. Las [instrucciones oficiales de FBNeo](https://docs.libretro.com/library/fbneo/#building-romsets-for-fbneo) y la [guía de romsets de MAME](https://docs.mamedev.org/usingmame/aboutromsets.html) explican los formatos y dependencias. Los nombres/versiones anteriores identifican las colecciones comprobadas; el listado contiene los CRC y hashes que deciden la compatibilidad real.

No se necesita una colección completa en el servidor: basta con los **46 juegos y las dos BIOS** del listado. Se preparan fuera de las colecciones originales y se colocan **48 ZIP** en `data/roms/`. `tetris.zip` no se necesita para una instalación nueva.

## Instalar y preparar en Windows

1. Clona el repositorio o extrae sus fuentes en una carpeta nueva.
2. Ejecuta `Instalar-Windows.cmd`. Prepara Node.js 24, dependencias, emuladores, Chromium, Caddy y la web compilada. Necesita Internet; no descarga juegos. No lo ejecutes con el servidor ya arrancado.
3. Para preparar los ZIP desde las colecciones anteriores, instala **Python 3.11 o posterior** y ejecuta en la raíz del proyecto, cambiando las dos rutas:

```powershell
python scripts/prepare-catalog-roms.py "D:\Colecciones\MAME 0.287 ROMs (merged)" --fallback "D:\Colecciones\FinalBurn Neo 1.0.0.3 (a2594cf) (Arcade only) (Non-Merged)\Roms"
npm.cmd run roms:check
npm.cmd run integrity
```

4. Si las comprobaciones terminan correctamente, ejecuta `Iniciar-Windows.cmd`. Para usar solo este PC: `Iniciar-Windows.cmd -LocalOnly`. La configuración LAN de cada equipo se realiza según [RED_WINDOWS.md](RED_WINDOWS.md); no copies las claves ni la CA de otra instalación.

## Instalar y preparar en Linux

1. Clona o copia las fuentes sin `node_modules`, `.cache`, datos ni builds.
2. Ejecuta `bash instalar-linux.sh` con un usuario normal. El instalador indica las dependencias del sistema y puede pedir `sudo` para instalarlas. Se necesita Internet.
3. Con **Python 3.11 o posterior**, prepara las ROMs indicando las rutas de tus colecciones:

```sh
python3 scripts/prepare-catalog-roms.py "/mnt/colecciones/MAME 0.287 ROMs (merged)" --fallback "/mnt/colecciones/FinalBurn Neo 1.0.0.3 (a2594cf) (Arcade only) (Non-Merged)/Roms"
npm run roms:check
npm run integrity
bash iniciar-linux.sh
```

Linux arranca en `http://127.0.0.1:3000`. Para otros dispositivos, configura el proxy HTTPS descrito en [INSTALACION.md](INSTALACION.md).

## Directorio de ROMs y opciones de preparación

```text
proyecto/
  config/rom-requirements.json     # Se publica; metadatos de compatibilidad
  data/                           # Se genera localmente; NO se publica
    roms/
      columns.zip
      contra.zip
      ... otros 44 juegos ...
      neogeo.zip
      konamigx.zip
      import-manifest.json        # Lo genera el preparador
```

Conserva cada juego y BIOS en su ZIP; no crees subcarpetas dentro de `roms`. En Linux usa exactamente los nombres en minúsculas del listado.

El preparador busca componentes por tamaño y CRC en ambas colecciones, reúne padres y clones y **comprueba el SHA-256 final antes de sustituir un archivo**. Copia intactos los seis ZIP originales aprobados de `columns`, `contra`, `mslug`, `mslug2`, `1941` y `neogeo`; no los recomprimas. Si faltan componentes o hay una discrepancia, informa del error y conserva el archivo instalado. No modifica las colecciones originales ni descarga nada.

Para preparar solo una parte:

```sh
python scripts/prepare-catalog-roms.py "RUTA_MAME" --fallback "RUTA_FBNEO" --games kof98 maglord neogeo
```

Para un directorio de datos personalizado, copia `.env.example` a `.env`, ajusta `DATA_DIR` y pasa también el destino al preparador; este script Python **no lee `.env`**:

```sh
python scripts/prepare-catalog-roms.py "RUTA_MAME" --fallback "RUTA_FBNEO" --destination "RUTA_DATOS/roms"
npm run roms:check -- "RUTA_DATOS/roms"
```

Si ya tienes los **ZIP aprobados y preparados**, puedes copiarlos directamente al directorio final y ejecutar `npm run roms:check`, sin Python. Que el juego arranque con otro ZIP no garantiza que el servidor acepte su puntuación. No desactives la comprobación de hashes para resolver una incompatibilidad.

## Comprobación antes de jugar

`npm run roms:check` debe indicar **48/48 ZIP aprobados** y `npm run integrity` debe validar los emuladores instalados. La primera cuenta se crea con el código de instalación mostrado en la consola del servidor; no se distribuye ninguna cuenta o contraseña del propietario.

Se han comprobado en este equipo los 48 ZIP preparados con las colecciones indicadas, sus hashes y las comprobaciones del servidor. La instalación de paquetes, el rendimiento y los mandos del equipo de destino deben comprobarse allí; no se promete compatibilidad de cualquier ROMset con el mismo nombre de juego.

# Linux y red local

Se ha preparado Docker Compose para el Ubuntu del propietario; aún no se ha ejecutado en ese equipo. No se ha abierto ningún puerto del router.

## Arranque con Docker

Copia el proyecto sin `node_modules`, `.cache` ni cuentas de prueba. Dentro de su carpeta en Linux:

```bash
docker compose up -d --build
docker compose logs arcade
```

El nombre predeterminado es `arcade.home.arpa`. Configura DNS local o hosts para apuntarlo a la IP del servidor. También puedes definir `ARCADE_HOST=192.168.1.50`, sustituyendo esa IP de ejemplo por la del servidor, en `.env` para Compose. No incluyas protocolo ni barra final.

El proxy genera certificados locales. Copia solo el certificado público:

```bash
docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./arcade-lan-root.crt
```

Instálalo como autoridad de confianza en los dispositivos y abre `https://arcade.home.arpa`. No distribuyas `root.key`. Dentro de Docker la confianza no se instala automáticamente en los clientes. Aceptar una advertencia no sustituye configurar la confianza correctamente.

Un dominio y un certificado de una autoridad pública permiten evitar distribuir una CA local; requieren configurar el dominio y su emisión. [Documentación de Caddy sobre HTTPS local](https://caddyserver.com/docs/automatic-https#local-https).

Los dispositivos necesitan comunicación con el servidor en la LAN, sin aislamiento de clientes Wi-Fi. El servidor emula y codifica en Chromium; todos los jugadores reciben vídeo y audio. Compose usa `network_mode: host`, destinado a Linux, para que WebRTC anuncie direcciones accesibles de la LAN. Node queda en loopback; no publiques su puerto 3000 externamente. La conectividad multimedia y el rendimiento deben probarse en los dispositivos reales.

Chromium se instala durante la construcción, con sandbox habilitado y usuario sin privilegios. El perfil seccomp incluido permite crear los espacios de nombres necesarios. Si Ubuntu restringe esos espacios de nombres, revisa los registros y la configuración del host; no añadas `--no-sandbox`. El límite inicial es `MAX_SERVER_GAMES=2`, con 6 GB de memoria y cuatro CPU para el servicio en Compose. Ajusta solo después de medir.

## ROMs y administrador

Prepara `data/roms` con el importador del README y copia esos archivos al volumen:

```bash
docker compose cp ./data/roms/. arcade:/app/data/roms/
docker compose exec arcade npm run integrity
```

El usuario del servicio debe poder leer los ZIP y escribir en su volumen. El importador no reconstruye ROMsets ni descarga BIOS.

Crea la primera cuenta con el código de `docker compose logs arcade`, antes de dar acceso a los demás. El panel está en `/#/admin`.

## Sin Docker

Para la instalación nativa usa **`bash instalar-linux.sh`** y después **`bash iniciar-linux.sh`** desde la carpeta del proyecto. El instalador prepara Node.js 24 local si falta, ejecuta `npm ci --include=dev`, instala las bibliotecas de Chromium con Playwright, descarga el navegador y los componentes del emulador y compila la web. Comprueba además que Chromium arranca con sandbox. Solo la instalación de paquetes del sistema puede pedir `sudo`; ejecuta ambos scripts como usuario normal. Se conserva `.env` si existe y no se reemplazan cuentas ni ROMs.

`bash instalar-linux.sh --check` comprueba los archivos instalados sin descargar nada. `--skip-system-deps` permite omitir los paquetes del sistema si ya están disponibles. Linux x64 y ARM64 están contemplados; las bibliotecas automáticas dependen del soporte de la distribución en [Playwright](https://playwright.dev/docs/browsers#install-system-dependencies). Para otras distribuciones prepara las bibliotecas correspondientes antes de omitir ese paso. El instalador requiere curl o wget, certificados, tar, xz y sha256sum para preparar Node cuando no está instalado.

El iniciador utiliza el servidor nativo en loopback y las opciones de `.env`; no configura un proxy HTTPS, firewall ni servicio automático. Para conectarse desde otros equipos sigue las opciones HTTPS de esta guía o utiliza Compose. La aplicación automática de «Red y acceso» al proxy sigue siendo específica del iniciador de Windows.

Instala Node 24 y ejecuta `npm ci`, `npm run emulator:install`, `npm run server:install`, `npm run build` y `npm start`. En Linux instala además las dependencias del sistema de Chromium mediante `npx playwright install-deps chromium`, con los permisos administrativos correspondientes. La caché predeterminada es `.cache/server-browsers`; `PLAYWRIGHT_BROWSERS_PATH` permite cambiarla.

Utiliza un usuario propio sin privilegios, una unidad de servicio y un proxy HTTPS. El usuario del servicio necesita poder ejecutar Chromium con sandbox y escribir en su caché/datos. `.env.example` escucha en loopback. En el mismo ordenador, `http://127.0.0.1:3000` es un contexto local admitido. Para otros equipos usa HTTPS.

## Restauración

Crea y descarga copias desde Administración → Servidor. Conserva copias también fuera del disco del servidor.

Detén la instancia que vaya a usar los datos. El destino debe ser nuevo:

```bash
node scripts/restore-backup.mjs /ruta/arcade-copia.tar.gz /ruta/nuevos-datos
```

El restaurador comprueba SQLite y sus referencias y cierra todas las sesiones. Apunta `DATA_DIR` al destino, importa sus ROMs y arranca. Para Docker, restaura aparte y copia al volumen de una instancia detenida. Conserva los datos antiguos hasta comprobar la recuperación; el script no los sobrescribe.

Sin `encryption-key` no se pueden descifrar las claves anteriores de RetroAchievements. Las copias la incluyen. El código inicial de instalación no es necesario para acceder con administradores existentes.

## Internet

El modo actual usa WebRTC sin ICE externo para LAN. Faltan STUN/TURN, credenciales y límites del relé, certificado público y pruebas entre redes. Para registro público hace falta protección adicional contra bots. No basta con reenviar el puerto 3000.

# Seguridad e integridad

Primera implementación para validar en LAN. Estos controles no equivalen a una auditoría independiente ni a una garantía de invulnerabilidad.

## Cuentas y permisos

- Contraseñas de 12 caracteres como mínimo, con scrypt, sal aleatoria y comparación resistente a diferencias de tiempo.
- Primer administrador protegido por un código local aleatorio.
- Sesiones de siete días, identificador guardado como hash, cookie HttpOnly y SameSite=Strict. Secure se activa en el despliegue HTTPS.
- Protección CSRF y comprobación de origen en peticiones y WebSocket.
- Límites de registros, accesos, desafíos, mensajes, imágenes y peticiones. Honeypot y desafío aritmético de un uso con caducidad.
- Comprobación de sesión y suspensión en cada petición y evento en tiempo real. Máximo de seis conexiones por cuenta.
- Suspender revoca sesiones y controles, cierra sus salas y retira su pertenencia a otras.
- Se protege el último administrador activo.
- SQL parametrizado e índice único que impide asignar el mismo puesto dos veces.

El desafío aritmético es antispam básico. Un bot sofisticado puede resolverlo. Para registro público por Internet se necesita protección adicional sin desactivar los límites.

## Salas y archivos

Los permisos se aplican a salas, mensajes, imágenes, ROMs, BIOS, señales y controles. El servidor determina el puesto de cada entrada; el cliente no puede elegir el de otro jugador. Las señales solo circulan entre el motor privado y jugadores autorizados de la misma sala. Se limitan también los eventos de control por conexión.

Los nombres de ROMs se limitan a ZIP sin carpetas. El motor privado recibe solo los archivos asignados a su juego mediante interceptación de Playwright; las rutas de ROM/BIOS para clientes devuelven acceso denegado. No hay exploración del sistema ni ejecución de comandos recibidos por la web.

Las imágenes del chat tienen límite de píxeles, tamaño máximo de 1600×1600 y se convierten a WebP sin conservar los metadatos originales. Se admiten PNG, JPEG y WebP de hasta 4 MB. Máximo de 50 subidas por cuenta/día y cuota global configurable de 2 GB por defecto. Su lectura exige pertenecer a la sala o ser administrador. Ya no se admiten capturas como envío de puntuación.

Se procesan como máximo cuatro subidas simultáneas para limitar la memoria utilizada al decodificar imágenes.

El chat no interpreta HTML. Solo enlaza HTTP(S) e incrusta formatos conocidos de YouTube/Vimeo. El administrador modera globalmente y el anfitrión su sala.

## Motor web

EmulatorJS 4.2.3 y los archivos del núcleo están fijados con SHA-256 en `config/emulator-lock.json`. El instalador rechaza discrepancias al reinstalar. El servidor comprueba esos archivos al arrancar y bloquea partidas si falta alguno o cambia.

El instalador desactiva explícitamente la comprobación remota de actualizaciones de `emulator.js`; registra el hash oficial y el instalado. No se necesita un CDN durante las partidas.

Este Emscripten usa `new Function`: solo `/play.html` permite `unsafe-eval`; la comunidad mantiene una política más estricta. Se permiten WebAssembly, trabajadores y blobs locales necesarios para el motor. Esta excepción debe revisarse al actualizar.

El adaptador utiliza WebGL 2 cuando se admite y salida FBNeo de 16 bits para corregir la transparencia observada en las pruebas.

Cada sala activa tiene un proceso Chromium privado con sandbox habilitado, sin cookies de usuarios, descargas ni service workers. Su tráfico HTTP se limita al origen local y los recursos necesarios del motor. No se desactiva el sandbox como alternativa si Linux impide iniciarlo. Dos motores simultáneos por defecto, un minuto sin conexiones y dos horas de duración máxima limitan el consumo; estos límites no sustituyen una prueba de carga.

Node obtiene puntuaciones de la RAM de su motor; no acepta cifras, archivos de récords ni resultados calculados por navegadores de usuarios. Los lectores están ligados a hashes concretos de ROM/BIOS y al motor fijado. Cada participación usa un crédito y un inicio, con identidad vinculada al puesto. Esto no impide bots de controles ni garantiza que todos los estados de fin de partida hayan sido detectados correctamente: quedan para la validación jugable del propietario.

## Secretos y copias

La Web API Key de RetroAchievements usa AES-256-GCM con nonce aleatorio y una clave local separada de SQLite. No vuelve al navegador ni entra en el bundle. No se solicita la contraseña de RetroAchievements. Hay caché de diez minutos.

`data/encryption-key`, `data/setup-code`, SQLite, imágenes y copias deben ser accesibles solo por la cuenta del servicio y sus administradores. Datos, ROMs y `.env` se excluyen del repositorio y la construcción Docker.

Las copias contienen una instantánea consistente de SQLite, imágenes y clave de cifrado; excluyen ROMs y emulador. Solo los administradores descargan las copias. Se admiten hasta diez. El archivo no se cifra: guárdalo en un destino privado o cifrado. El restaurador exige un destino nuevo, rechaza enlaces y rutas ajenas al formato y elimina las sesiones restauradas.

## Linux

La aplicación Docker usa un usuario sin privilegios, raíz de solo lectura, sin capacidades ni escalado y con límites de memoria/CPU/procesos. El perfil seccomp permite los espacios de nombres que necesita el sandbox de Chromium. Compose usa red del host en Linux para las conexiones WebRTC; Node escucha exclusivamente en 127.0.0.1 y Caddy atiende HTTPS. Mantén actualizados Ubuntu, Docker y las imágenes base.

`TRUST_PROXY=1` requiere un proxy propio sin acceso directo externo a Node. Mantén la escucha de Node en loopback al usar la red del host. HTTPS válido es necesario también en LAN para jugar desde otros equipos.

La auditoría conserva acciones administrativas sin secretos. No es inmutable frente a alguien con acceso al disco. Mantener copias externas y supervisar el host sigue siendo necesario.

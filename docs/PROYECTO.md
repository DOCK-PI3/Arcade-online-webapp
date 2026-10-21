# Alcance y decisiones

Actualizado el 18 de octubre de 2026. El estado comprobado está en VALIDACION.md.

## Decisiones del propietario

- Acceso y multijugador desde el navegador. El propietario aceptó trasladar la emulación al servidor para obtener puntuaciones sin confiar en datos del cliente. Se sustituye la consulta externa de logros por medallas propias del salón.
- Primera instalación en LAN. Destino: Ubuntu 26.04, Xeon v2/v3 por concretar, 64 GB DDR3 y RX 6600 XT de 8 GB.
- ROMsets: FBNeo 1.0.0.3 (a2594cf), arcade non-merged, y MAME 0.287 merged.
- Catálogo activo: 46 juegos. Base: Columns (World), Contra, Metal Slug 1, Metal Slug 2 y 1941; ampliaciones en [CATALOGO_MAME.md](CATALOGO_MAME.md) y [CATALOGO_FBNEO.md](CATALOGO_FBNEO.md). Columns sustituye al Tetris anterior por petición del propietario; se conserva su historial desactivado.
- Dispositivos objetivo: PC y, desde la ampliación del 17 de octubre de 2026, móviles y tablets Android. Se admiten teclado, mando USB/Bluetooth y controles táctiles con detección automática. El sonido se autoriza con el primer toque del reproductor o «Jugar con sonido».
- Registro abierto con antispam. Primera cuenta administradora protegida por un código local de instalación.
- Puntuaciones automáticas leídas en el servidor; imágenes y vídeos solo para el chat.
- Capturas reales del catálogo y apariencia clara, oscura o del sistema por cuenta.
- Cuando se llenan los puestos, los demás miembros solo participan en el chat.
- Panel de administración y atención especial a la seguridad e integridad del servidor.

## Arquitectura implementada

Una instancia de FBNeo en Chromium aislado del servidor por sala. Todos los jugadores reciben vídeo y audio por WebRTC. El servidor autoriza pertenencia, puestos, señales y cada entrada de control. Cada sala conserva hasta 64 miembros y entre uno y cuatro puestos según el juego. El límite predeterminado es de dos motores simultáneos.

SQLite conserva usuarios, sesiones, catálogo, amistades, salas, invitaciones, mensajes, partidas, participantes, puntuaciones y auditoría. Las imágenes del chat se validan y convierten a WebP. ROMs y BIOS permanecen en el servidor: solo el contexto privado del motor puede cargarlas.

No se utiliza el netplay experimental de EmulatorJS: el adaptador propio integra transmisión y permisos con las salas. Emular y codificar ahora consume recursos del servidor; el rendimiento y la aceleración disponibles se deben comprobar en Linux.

## Panel personal y medallas

El perfil separa «Mi actividad», «Mis medallas» y «Mis opciones». Conserva estadísticas, últimas participaciones, mejores marcas automáticas, controles, apariencia, amistades y cambio de contraseña. Las participaciones de la estadística anterior cuentan conexiones por sala; las medallas de partidas y exploración requieren una puntuación emitida por el motor tras detectar juego activo.

Se retira la integración de RetroAchievements y se borran sus credenciales y caché de la base activa. Hay 50 medallas generales y una por juego para quedar primero al registrar un resultado finalizado. Con los 46 juegos actuales son 96; al llegar a 50 juegos serán 100. Las insignias SVG, filtros, progreso y fecha de obtención están en la vitrina personal. El servidor concede las medallas y las persiste en SQLite; un navegador no puede presentar un contador o desbloqueo. Se recupera el historial comprobable y se conservan las medallas ganadas aunque cambie el marcador o el catálogo. Reglas y lista: [MEDALLAS.md](MEDALLAS.md).

## Salas y puntuaciones

El anfitrión conserva el primer puesto y puede cerrar la sala o crear invitaciones. Los demás entran al chat y solicitan puestos libres. Al cerrar la sala, esta deja de admitir accesos y la partida se detiene. Desconectarse del juego libera la conexión, pero la reserva de puesto permanece hasta dejarla o salir de la sala.

Cada invitación sirve una vez y caduca en 48 horas. Revocarla impide nuevos usos; no expulsa a quien ya la aceptó. Los miembros admitidos conservan su pertenencia hasta salir, ser suspendidos o cerrarse la sala.

Los lectores de RAM están ligados a los ZIP y al núcleo fijados. Los 46 juegos activos disponen de lector; se conserva además el de Tetris para su ficha retirada. El lector de Columns distingue los estados de selección, juego y fin por puesto, incluye las bonificaciones iniciales de dificultad y contrasta la puntuación binaria con su copia BCD. La cuenta queda vinculada al puesto al insertar el crédito. Se admite un crédito por participante; una nueva partida requiere preparar otra desde la sala. Los resultados en curso quedan en el perfil y los finalizados alimentan la mejor marca por cuenta y juego. No se aceptan resultados enviados por clientes. Las antiguas puntuaciones manuales permanecen en la base, excluidas del marcador actual.

El marcador web persiste en SQLite. La tabla nativa de la recreativa (.hi/NVRAM) y sus iniciales todavía no se guardan ni extraen. Los lectores y la atribución requieren las pruebas de partidas completas que realizará el propietario. Ejecutar el motor en el servidor reduce la manipulación del resultado, pero no impide automatizar controles.

## Pendiente

1. Pruebas entre equipos físicos y con los mandos del propietario.
2. Despliegue real en Ubuntu y certificados HTTPS de los clientes.
3. Partida prolongada de cuatro jugadores con dispositivos físicos; los cuatro puestos de G.I. Joe y sus marcadores ya se comprobaron en el motor.
4. STUN/TURN y pruebas externas antes de usar Internet.
5. Protección adicional contra bots si se abre el registro públicamente.
6. Correo de recuperación, MFA y guardados compartidos no están incluidos en esta implementación.

## Referencias

- [EmulatorJS 4.2.3](https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3).
- [Opciones de EmulatorJS](https://emulatorjs.org/docs/options/).
- [HTTPS local con Caddy](https://caddyserver.com/docs/automatic-https#local-https).

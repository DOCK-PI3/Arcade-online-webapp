# Acceso desde la red local en Windows

La instalación de este PC está preparada para `192.168.0.22`. La IP se elige en **Administración → Red y acceso**; no está fijada en el código. Reserva esa IP en el DHCP del router si quieres que no cambie tras reiniciar el PC.

## Iniciar y conectar

1. Abre `Iniciar-red.cmd`. Si ya existe una instancia, ciérrala antes de abrir otra. La ventana debe permanecer abierta. También puedes ejecutar `npm run network:start`.
2. La primera vez, abre `Permitir-red-local.cmd` y acepta la elevación de Windows. Permite únicamente los programas del proyecto, en redes privadas y desde la subred local. No abre puertos del router. Si cambias el puerto HTTPS o reinstalas Chromium, vuelve a ejecutarlo.
3. Desde Android, abre `http://192.168.0.22:3000`. Esta página solo prepara el certificado y no pide contraseñas.
4. Descarga el certificado, instala el archivo como **certificado de CA** desde los ajustes de Android y comprueba su huella con Administración → Red y acceso. No distribuyas las claves privadas.
5. Reinicia Chrome y abre `https://192.168.0.22`. Debe abrir sin advertencias de certificado. Aceptar una excepción no sustituye la confianza en la CA.

En Android los nombres varían por fabricante: Seguridad y privacidad → Más ajustes de seguridad → Cifrado y credenciales → Instalar certificado → Certificado de CA. [Ayuda oficial de Android/Pixel](https://support.google.com/pixelphone/answer/2844832?hl=es).

El PC conserva el acceso de desarrollo en `http://127.0.0.1:3000`. Para usar HTTPS también en el PC puedes importar su certificado local en tus certificados de usuario; el iniciador no lo instala automáticamente en el almacén de confianza.

## Jugar desde Android

Al conectar a una partida aparecen automáticamente la cruceta, A/B/C/D y Crédito/Inicio. Puedes mantener una dirección y una acción con varios dedos; la cruceta también permite diagonales y deslizar el dedo entre direcciones. Cada usuario controla únicamente su puesto.

Toca **Jugar con sonido** o cualquier control del juego para activar el audio. Android necesita una interacción dentro del reproductor para autorizarlo; el botón «Activar sonido» permite reintentarlo. Si silencias manualmente, jugar no vuelve a activar el sonido. Ajusta además el volumen multimedia del dispositivo.

Gira el dispositivo y pulsa **Pantalla completa** para situar los controles a los lados de la imagen. **Ocultar controles** permite jugar con un mando USB/Bluetooth conectado. Al volver a la sala o interrumpir un toque se liberan las pulsaciones.

Después de actualizar el reproductor, recarga la web y conecta a una partida nueva para utilizar la captura de audio corregida.

## Cambiar IP, puerto o dominio

En **Administración → Red y acceso** se eligen la IP real del equipo, el puerto HTTPS y un dominio opcional. El iniciador de Windows observa la configuración y la aplica al proxy cada pocos segundos, sin reiniciar las partidas. Si el puerto está ocupado o la dirección no es válida, consulta la consola. Al cambiar el puerto actualiza también el firewall con `Permitir-red-local.cmd`.

Los ajustes se conservan en SQLite y entran en sus copias. La autoridad y certificados están en `data/network-pki`; conserva una copia privada de esa carpeta aparte. La copia descargable de la aplicación todavía no incluye la PKI. Si eliminas esa carpeta se genera otra autoridad y tendrás que volver a preparar los dispositivos. Solo el certificado público se publica, en una carpeta separada de la clave privada.

El backend escucha en loopback. Caddy escucha HTTPS y la página de preparación en la IP local seleccionada. Su administración permanece en `127.0.0.1:2020`. Caddy 2.11.7 se descarga desde la publicación oficial y se verifica con SHA-256 mediante `npm run network:install`.

## Preparar acceso desde Internet

Selecciona el modo de dominio e introduce un nombre que controles, sin protocolo, rutas ni puerto. Por ejemplo, [Duck DNS](https://www.duckdns.org/) proporciona subdominios gratuitos; su alta y actualización de DNS se realizan con tu cuenta en ese servicio. Configurar el campo no registra un dominio ni modifica DNS o el router.

Para la web pública hay que apuntar el dominio a la IP pública, habilitar de forma deliberada el acceso externo al proxy y dirigir los puertos necesarios del router. Caddy intentará obtener el certificado público cuando se configure el dominio. Si tu conexión usa CGNAT, el reenvío de puertos puede no estar disponible. El acceso LAN continúa usando su certificado local.

Las partidas desde redes externas siguen pendientes de configuración STUN/TURN y validación real de conectividad, latencia, relé y protección del registro público. El campo de dominio prepara la dirección web; no certifica que el multijugador externo ya funcione. Esta instalación continúa limitada a la LAN.

En Linux utiliza por ahora `docs/INSTALACION.md` y Compose; la aplicación automática de los ajustes web al proxy descrita aquí corresponde al iniciador de Windows.

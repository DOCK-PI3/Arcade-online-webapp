# Cambio solicitado: puntuaciones automáticas

Actualizado el 16 de octubre de 2026. Implementada la ejecución en el servidor, Columns y la ampliación documentada en [CATALOGO_MAME.md](CATALOGO_MAME.md). El propietario realizará las pruebas jugables y de puntuación; la automatización no acredita todavía el fin de partida y la atribución en todas las situaciones reales.

## Requisitos del propietario

- Publicar automáticamente la puntuación, sin escribirla en un formulario ni adjuntar una captura.
- Conservar las mejores marcas. La extracción de iniciales y persistencia de tablas internas quedan pendientes; el marcador actual identifica por cuenta.
- Las imágenes y los enlaces de vídeo corresponden al chat.
- Evitar que cambiar una cifra o subir un archivo modificado permita obtener un récord.

## Qué proporcionan los emuladores

`hiscore.dat` describe regiones de memoria que contienen tablas de récords. MAME puede guardar esas regiones en archivos binarios `.hi`; algunos juegos conservan sus datos en memoria no volátil. FBNeo también admite `hiscore.dat` cuando el núcleo y el juego lo soportan.

El adaptador web instalado expone el sistema de archivos virtual de Emscripten y operaciones para guardar archivos. Eso permite investigar su persistencia, pero todavía hay que probar el guardado y la lectura por juego. No existe un formato universal de puntuación e iniciales listo para enviarlo al marcador de la comunidad.

Leer únicamente la tabla de récords tampoco registra todas las partidas: un resultado inferior al último puesto de la tabla puede no aparecer. Para contar cada resultado hacen falta reglas por juego que detecten jugador, puntuación, fin de partida y, si existe, confirmación de iniciales.

## Identidad y reglas

La cuenta se atribuye mediante el puesto autorizado por el servidor durante la partida, no mediante las iniciales. Deben conservarse las identidades de los participantes y evitar atribuir resultados antiguos o de demostración al usuario que abre una sala.

Las partidas clasificadas necesitan reglas fijas sobre créditos, continuaciones, dificultad, trucos, reinicios y estados guardados. Un cambio de participante no debe transferir los puntos acumulados por otro usuario. Los resultados deben conservar referencia a partida, puesto, versión del motor y reglas para evitar duplicados y permitir revisión.

La restauración de una tabla antigua puede servir para mostrar récords dentro de la recreativa, pero no debe volver a publicarlos como nuevas partidas. Una tabla compartida y el marcador por cuentas tienen funciones diferentes.

## Límite de confianza

El diseño anterior ejecutaba el emulador en el navegador anfitrión. Un usuario que controla ese navegador puede modificar memoria, archivos y peticiones. Un hash, una firma calculada en JavaScript o un botón de trucos oculto no prueban que su puntuación sea legítima.

El diseño actual ejecuta cada partida en Chromium del servidor, con su sandbox activado. Los clientes envían controles; Node lee la RAM de su propio motor y registra los resultados. No existe una ruta pública para publicar puntuaciones. Quedan por comprobar audio, vídeo, latencia, consumo y aislamiento en el Linux de destino. Reduce la manipulación del resultado por el cliente; no permite prometer ausencia absoluta de trampas, por ejemplo automatización de controles.

Otra posibilidad es validar repeticiones de entradas en el servidor manteniendo la emulación del cliente. No está implementada: exige capturar entradas por fotograma y reproducir de forma determinista desde un estado y reglas controlados, además de comprobar el resultado independientemente.

El propietario eligió explícitamente ejecutar las partidas que puntúan en el servidor.

## Implementación y límites

La ampliación del 18 de octubre deja **46 juegos activos** con lectores. [CATALOGO_FBNEO.md](CATALOGO_FBNEO.md) detalla los 16 nuevos, sus 37 puestos, controles y pruebas. Kick Off registra goles; OutRunners registra el mayor recorrido alcanzado según la decisión del propietario; KOF ’98 conserva el máximo nativo observado aunque cambie el contador entre combates. Sus unidades aparecen en el marcador y en el perfil.

`server/score-readers.js` contiene los lectores del catálogo base y carga los de la ampliación desde `config/catalog-score-layouts.json`, con tamaño de memoria y hashes de ROM/BIOS permitidos. Tetris se conserva desactivado por su historial. `server/game-runtime.js` controla el motor privado, un crédito y un inicio por cuenta/puesto, el máximo observado y el cierre de participación. SQLite conserva partida, puesto, usuario, reglas y hash del manifiesto del motor para evitar duplicados.

Los lectores exigen observar participación real; cada juego define si necesita observar inicialmente cero o admite un valor inicial positivo. Se finaliza al detectar inactividad del jugador, desconectarlo o detener la partida. Un cambio de cuenta en el mismo puesto exige una partida nueva. El propietario puede preparar otra desde la sala. En Tetris de dos jugadores ambos deben insertar crédito antes del primer Inicio.

Las pruebas de lectores usan muestras de memoria recogidas previamente, sin volver a ejecutar juegos. No demuestran todos los estados de selección, muerte, continuación o fin de partida. Los resultados web se conservan; no se ha integrado restauración de .hi/NVRAM ni extracción de iniciales. Las puntuaciones manuales antiguas se conservan como datos históricos, fuera del marcador actual.

## Fuentes

- [MAME: plugin de récords, archivos `.hi` y guardado automático](https://docs.mamedev.org/plugins/hiscore.html).
- [FBNeo: soporte de hiscores y requisitos](https://docs.libretro.com/library/fbneo/#hiscores).
- [Código de persistencia de FBNeo](https://github.com/finalburnneo/FBNeo/blob/master/src/burn/hiscore.cpp).
- [Base de regiones de récords de FBNeo](https://github.com/libretro/FBNeo/blob/master/metadata/hiscore.dat).
- Adaptador local: `public/emulator/src/GameManager.js`, versión fijada por `config/emulator-lock.json`.

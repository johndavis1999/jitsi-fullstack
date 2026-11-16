# Jitsi Meet autoalojado

Instancia propia de Jitsi Meet basada en la distribucion oficial Docker `stable-11248-3`. La configuracion local queda en `.env` y los datos persistentes en `.jitsi-meet-cfg/`; ambos se excluyen de Git.

## Requisitos

- Docker Engine y Docker Compose v2.
- En Linux, puertos locales `8000/tcp`, `8443/tcp` y `10000/udp` disponibles.

El Compose oficial publica estos puertos en todas las interfaces del equipo. Durante pruebas locales, no configures redireccionamiento de puertos en el router y limita el acceso con el firewall del sistema si la red no es de confianza.

## Inicio local

Desde la raiz del proyecto:

```sh
cp env.example .env
./gen-passwords.sh
mkdir -p .jitsi-meet-cfg/web \
	.jitsi-meet-cfg/prosody/config \
	.jitsi-meet-cfg/prosody/prosody-plugins-custom \
	.jitsi-meet-cfg/jicofo .jitsi-meet-cfg/jvb \
	.jitsi-meet-cfg/jigasi .jitsi-meet-cfg/jibri \
	.jitsi-meet-cfg/transcriber \
	.jitsi-meet-cfg/storage/jibri \
	.jitsi-meet-cfg/storage/prosody \
	.jitsi-meet-cfg/storage/transcripts \
	.jitsi-meet-cfg/storage/web \
	.jitsi-meet-cfg/tmp/web-crontabs \
	.jitsi-meet-cfg/tmp/web-load-test
cp customization/custom-config.js .jitsi-meet-cfg/web/custom-config.js
cp customization/custom-interface_config.js .jitsi-meet-cfg/web/custom-interface_config.js
chmod 777 .jitsi-meet-cfg/storage/jibri \
	.jitsi-meet-cfg/storage/prosody \
	.jitsi-meet-cfg/storage/transcripts \
	.jitsi-meet-cfg/storage/web \
	.jitsi-meet-cfg/tmp/web-crontabs \
	.jitsi-meet-cfg/tmp/web-load-test
docker compose pull
./scripts/generate-lan-certs.sh
docker compose up -d
```

En el mismo equipo puedes usar <http://localhost:8000>. Una IP de LAN por HTTP no es un contexto seguro para WebRTC; usa HTTPS. Tras `./scripts/generate-lan-certs.sh`, confia la CA en Chromium/Linux del anfitrion con `certutil -A -d "sql:$HOME/.pki/nssdb" -n "Meeting LAN Root CA" -t "C,," -i .local-certs/lan-ca.crt` y reinicia el navegador si ya estaba abierto. Desde otra laptop, transfiere unicamente `.local-certs/lan-ca.crt` e importalo como autoridad raiz de confianza en el sistema o navegador; nunca copies `lan-ca.key`. Abre <https://192.168.31.244:8443>. Permite `8443/tcp` y `10000/udp` en el firewall del host para la red local. Si cambia la IP del host, actualiza `certs/lan-server.cnf`, `.env` y `env.example`, y vuelve a generar los certificados.

El override de `customization/custom-config.js` mantiene WebSocket sin TLS unicamente para `http://localhost`; desde la laptop se usa HTTPS y la URL segura generada por Jitsi. Para detener los servicios ejecuta `docker compose down`.

Los directorios `storage` y `tmp` deben existir y ser escribibles por los contenedores (UID 1000). Los permisos `777` siguen el requisito del despliegue oficial para este arranque local; en un VPS conviene limitar permisos al usuario de servicio adecuado.

## Personalizacion

Jitsi admite ajustes de interfaz sin modificar las imagenes ni el codigo upstream. Crea y edita estos archivos dentro de `.jitsi-meet-cfg/web/`:

- `custom-config.js` para opciones de `config.js`.
- `custom-interface_config.js` para opciones de `interface_config.js`.

El proyecto incluye `customization/custom-config.js` para el ajuste local de WebSocket y `hideLoginButton`. En el lobby de espera, esta versión de Jitsi renderiza su acceso de login fuera del diálogo controlado por esa opción; el override oculta ese botón y cambia el mensaje para indicar que se espera al anfitrión. El contenedor agrega estos archivos a la configuración web generada; tras editarlos, reinicia `docker compose restart web` para aplicarlos. La admisión al lobby sigue funcionando y la autenticación del anfitrión permanece en el frontend/backend.

El logo de la conferencia se toma de `logo.png` en la raiz del proyecto. Docker lo monta en modo solo lectura y `custom-config.js` configura su URL. Para aplicar el montaje o reemplazar la imagen, ejecuta `docker compose up -d --no-deps --force-recreate web`; esto interrumpe temporalmente las conexiones activas. Recarga la pagina sin cache para ver la nueva version.

Todas las salas utilizan lobby obligatorio: los invitados esperan hasta que un moderador los admita desde el panel de participantes, individualmente o mediante la opcion de admitir a todos. La entrada del anfitrion no admite automaticamente a quienes esperan. `prosody-plugins-custom/mod_required_lobby.lua` activa el lobby antes de procesar las entradas; no se permite desactivarlo ni usar una contrasena para evitar la aprobacion.

En la portada de Jitsi, las salas con nombres normales se abren con el prefijo `native-`: la primera persona que entra es moderador sin autenticacion y los demas esperan en el lobby. Una sala UUID o una URL con JWT conserva el comportamiento protegido de la integracion. Esta modalidad nativa no verifica la identidad: cualquiera que conozca o adivine el nombre y llegue primero puede ser moderador. Es solo para pruebas o entornos de confianza, no para produccion.

Para aplicar esta configuracion en una instalacion existente, ejecuta `./scripts/setup-jitsi-jwt.sh` y despues `docker compose up -d --no-deps --force-recreate prosody jicofo web`. Esto desconecta las reuniones activas. Para comprobar el modulo de forma aislada, ejecuta `docker run --rm --entrypoint lua -v "$PWD/prosody-plugins-custom:/tests:ro" ghcr.io/jitsi/prosody:stable-11248-3 /tests/test-required-lobby.lua /tests/mod_required_lobby.lua`.

## Frontend React

El subproyecto [frontend](frontend/README.md) integra la instancia con `@jitsi/react-sdk`. Con la CA LAN generada y confiada en el equipo, ejecuta desde la raiz:

```sh
npm --prefix frontend install
npm --prefix frontend run dev
```

Vite sirve HTTPS en `5174`; el puerto `5173` redirige automáticamente a HTTPS. Desde el host abre <https://localhost:5174>; desde otra laptop abre <https://192.168.31.244:5174> y confia `.local-certs/lan-ca.crt` en ese dispositivo. La direccion de Jitsi se configura con `frontend/.env.local` a partir de `frontend/.env.example`.

En este host UFW esta activo. Para permitir el acceso desde la LAN, abre ambos puertos TCP solo para la subred local:

```sh
sudo ufw allow from 192.168.31.0/24 to any port 5173:5174 proto tcp
```

Luego verifica con `sudo ufw status`. No hace falta cambiar los puertos de Jitsi (`8000`, `8443`, `10000/udp`).

## Backend Node

El subproyecto [backend](backend/README.md) ofrece cuatro usuarios ficticios y diez reuniones estaticas, reutilizables por su UUID. Arrancalo con `npm --prefix backend run dev`; su API HTTPS usa el puerto `3001`. El script `./scripts/setup-jitsi-jwt.sh` configura un secreto JWT compartido, habilita autenticación por token y deja a los invitados esperando hasta el anfitrión. Los tokens del anfitrión se limitan a su sala y vencen en 30 días. Reinicia los servicios Jitsi solo cuando no haya reuniones activas. Para permitir acceso desde laptops de la LAN con UFW:

```sh
sudo ufw allow from 192.168.31.0/24 to any port 3001 proto tcp
```

El endpoint `GET /api/users/:userId/meetings` devuelve solo las reuniones cuyo anfitrion sea ese usuario. Desde el frontend puedes copiar el enlace `https://192.168.31.244:5174/<UUID-de-reunion>`; quien lo abra usará el usuario guardado en su sesión y entrará a la sala permanente. La app resuelve el UUID con `GET /api/meetings/:meetingId`. Los perfiles aún son simulados: no hay login real, por lo que un usuario puede suplantar otro UUID; no expongas este prototipo como sistema de producción.

## Preparacion para VPS

Antes de exponer la instancia a Internet:

1. Asigna un dominio y crea su registro DNS apuntando a la IP publica del VPS.
2. Cambia `PUBLIC_URL` al dominio HTTPS, establece `HTTP_PORT=80` y `HTTPS_PORT=443`, y configura `ENABLE_LETSENCRYPT=1`, `LETSENCRYPT_DOMAIN` y `LETSENCRYPT_EMAIL` en `.env`.
3. Usa los puertos TCP `80` y `443`, y permite UDP `10000` en el firewall y en el proveedor del VPS.
4. Configura `JVB_ADVERTISE_IPS` con la IP publica del VPS para el trafico de audio y video.
5. Conserva `.env` y `.jitsi-meet-cfg/` al desplegar y respalda ambos; `.env` contiene credenciales internas.

No reutilices los secretos generados en otros servicios. No publiques `.env` ni expongas directamente los servicios internos XMPP.

## Actualizaciones

Esta instalacion parte del release oficial `stable-11248-3`. Consulta las notas de Jitsi antes de cambiar de release y conserva una copia de `.env` y `.jitsi-meet-cfg/` antes de actualizar.

Documentacion oficial: <https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/>.


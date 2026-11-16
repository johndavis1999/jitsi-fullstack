# Backend de reuniones

API de prototipo en Node.js + Express. Los cuatro usuarios y diez reuniones son estaticos y viven en `src/data.js`; no se usa una base de datos. Cada reunion tiene un UUID fijo y ese mismo valor se usa como `roomName` de Jitsi, asi que volver a abrirla lleva a la misma sala.

## Iniciar

Desde la raiz del proyecto:

```sh
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix backend run dev
```

El backend usa el certificado LAN ya generado y escucha por HTTPS en `3001`. Si se crean los certificados por primera vez, ejecuta `./scripts/generate-lan-certs.sh` desde la raiz antes de iniciar el servidor.

Para preparar la autenticacion JWT en Jitsi y en el backend, ejecuta una vez desde la raiz `./scripts/setup-jitsi-jwt.sh`. El script genera un secreto aleatorio si no existe y lo guarda de forma privada tanto en `.env` como en `backend/.env`; nunca lo imprime. Luego hay que reiniciar Jitsi en un momento sin reuniones activas para cargar la configuracion.

Con UFW activo, permite el puerto solo para tu subred LAN:

```sh
sudo ufw allow from 192.168.31.0/24 to any port 3001 proto tcp
```

## API

- `GET /api/health`: estado del servicio.
- `GET /api/users`: usuarios disponibles para la simulacion de sesion.
- `GET /api/users/:userId/meetings`: reuniones donde el usuario es anfitrion.
- `POST /api/meetings` con JSON `{"userId":"<uuid>"}`: crea una sala libre para ese perfil de prueba. Se almacena en memoria y desaparece al reiniciar el backend.
- `GET /api/meetings/:meetingId`: detalle de una reunion para resolver un enlace compartido.
- `POST /api/meetings/:meetingId/token` con JSON `{"userId":"<uuid>"}`: emite JWT solo si ese usuario es el anfitrion de la reunion. El token incluye el room UUID, `context.user.moderator=true` y dura 30 dias.

Ejemplo desde la raiz del proyecto:

```sh
curl --cacert .local-certs/lan-ca.crt https://localhost:3001/api/users
curl --cacert .local-certs/lan-ca.crt https://localhost:3001/api/users/36a5bf68-772a-4a14-9df5-8e2a35ad1011/meetings
curl --cacert .local-certs/lan-ca.crt https://localhost:3001/api/meetings/056829a1-6cc0-427c-a7bb-1f2c5e7f0011
curl --cacert .local-certs/lan-ca.crt -X POST -H 'Content-Type: application/json' -d '{"userId":"36a5bf68-772a-4a14-9df5-8e2a35ad1011"}' https://localhost:3001/api/meetings/056829a1-6cc0-427c-a7bb-1f2c5e7f0011/token
```

La respuesta de reuniones incluye `host` y `meetings`; cada elemento contiene `id`, `roomName`, `title`, `description`, `hostId` y `status`.

## Limites del prototipo

Los UUID de usuario identifican una simulacion, no una sesion autenticada. Aunque el endpoint solo firma para el `hostId` asignado, cualquiera puede suplantar otro UUID mientras no exista login real. El JWT de 30 dias es una credencial portadora reutilizable; guardarlo en `localStorage` permite que cualquier script ejecutado en ese origen lo lea. Esta duracion es solo para el prototipo. Los endpoints y datos no son seguridad real para produccion; la integracion cerrada requerira autenticacion de usuario, persistencia y autorizacion en servidor.

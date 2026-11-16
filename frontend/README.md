# Frontend

Aplicacion React + Vite integrada con la instancia autoalojada de Jitsi mediante `@jitsi/react-sdk`.

## Desarrollo

```sh
npm install
cp .env.example .env.local
../scripts/generate-lan-certs.sh
npm run dev
```

`VITE_JITSI_DOMAIN` acepta el host y puerto HTTPS, sin `https://`. Para la configuracion actual: `192.168.31.244:8443`. `VITE_BACKEND_URL` apunta al API HTTPS; por defecto es `https://192.168.31.244:3001`.

Con los certificados generados, Vite sirve HTTPS en `https://localhost:5174` y `https://192.168.31.244:5174`, sin ocupar los puertos de Jitsi. El puerto HTTP `5173` redirige automáticamente a HTTPS. Para entrar desde otra laptop, confia `.local-certs/lan-ca.crt` en ese equipo.

Si UFW esta activo en el host, permite `5173:5174/tcp` desde la subred LAN; ver la regla concreta en el README raiz.

La portada carga los perfiles con `GET /api/users`, guarda `{ id, name }` bajo la clave `user` de `localStorage` y consulta sus salas con `GET /api/users/:userId/meetings`. Cada boton de entrada pasa el `roomName` fijo de esa reunion al componente oficial `JitsiMeeting`.

Cada sala tiene un enlace compartible `https://<frontend>/<meeting-uuid>`. El boton de copiar enlace usa ese formato; al abrirlo, React consulta `GET /api/meetings/:meetingId`, muestra anfitrion y detalles y permite unirse usando automaticamente `user.name` como nombre en Jitsi. No hay campo para escribirlo. Si el anfitrion entra, solicita su JWT al backend y lo guarda por sala en `localStorage` durante su vigencia de 30 dias. Los invitados entran sin JWT y esperan en lobby hasta que un moderador los admita. Si el dispositivo invitado no tiene `user` guardado, el enlace lo dirige a seleccionar un perfil antes de volver a la invitacion.

La agenda permite crear salas libres temporales y abrir cualquier sala asignada en Jitsi nativo como moderador. Tambien permite copiar un enlace nativo para invitados sin JWT. El enlace que abre el moderador contiene un JWT portador en la URL y es privado: no debe compartirse, registrarse ni usarse como enlace de invitacion. Las salas libres existen solo mientras el backend siga en ejecucion. El perfil seleccionado es simulado y no autentica al usuario; este flujo es exclusivamente de prueba.

En React el nombre en el lobby es de solo lectura; en Jitsi nativo se puede introducir. Esta diferencia es de interfaz y no garantiza la identidad. Tras modificar `custom-config.js`, reinicia el servicio web de Jitsi cuando no haya reuniones activas.

El navegador debe confiar en `.local-certs/lan-ca.crt` para cargar el API y el iframe Jitsi desde la laptop. El backend debe permitir el origen frontend configurado y el puerto `3001/tcp` debe estar abierto en UFW para la subred LAN.

## Validacion

```sh
npm run lint
npm run build
```# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

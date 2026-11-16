import { createServer as createHttpServer } from 'node:http'
import { existsSync } from 'node:fs'
import { createServer as createViteServer, loadEnv } from 'vite'

const projectRoot = process.cwd()
const env = loadEnv('development', projectRoot, '')
const certificatePath = new URL('../.local-certs/lan-server.crt', import.meta.url)
const keyPath = new URL('../.local-certs/lan-server.key', import.meta.url)

if (!existsSync(certificatePath) || !existsSync(keyPath)) {
  console.error('Faltan certificados LAN. Ejecuta ../scripts/generate-lan-certs.sh desde frontend.')
  process.exit(1)
}

const allowedHosts = new Set([
  'localhost',
  '127.0.0.1',
  new URL(`https://${env.VITE_JITSI_DOMAIN || '192.168.31.244:8443'}`).hostname,
])

const vite = await createViteServer()
await vite.listen()

const redirectServer = createHttpServer((request, response) => {
  const host = request.headers.host?.split(':')[0].toLowerCase()

  if (!host || !allowedHosts.has(host)) {
    response.writeHead(400).end('Host no permitido')
    return
  }

  response.writeHead(308, {
    Location: `https://${host}:5174${request.url || '/'}`,
  }).end()
})

redirectServer.listen(5173, '0.0.0.0', () => {
  vite.printUrls()
  console.info('HTTP redirige a HTTPS en http://localhost:5173 y http://192.168.31.244:5173')
})

async function shutdown() {
  redirectServer.close()
  await vite.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
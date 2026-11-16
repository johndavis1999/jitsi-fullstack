import https from 'node:https'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createApp } from './app.js'

dotenv.config()

const certificatePath = fileURLToPath(new URL('../../.local-certs/lan-server.crt', import.meta.url))
const keyPath = fileURLToPath(new URL('../../.local-certs/lan-server.key', import.meta.url))

let certificate

try {
  certificate = {
    cert: readFileSync(certificatePath),
    key: readFileSync(keyPath),
  }
} catch {
  console.error('Faltan certificados LAN. Ejecuta ../scripts/generate-lan-certs.sh desde backend.')
  process.exit(1)
}

const port = Number.parseInt(process.env.PORT || '3001', 10)
const server = https.createServer(certificate, createApp())

server.listen(port, '0.0.0.0', () => {
  console.info(`Backend HTTPS disponible en https://localhost:${port}`)
  console.info(`Backend LAN disponible en https://192.168.31.244:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
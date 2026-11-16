import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const certificatePath = fileURLToPath(new URL('../.local-certs/lan-server.crt', import.meta.url))
const keyPath = fileURLToPath(new URL('../.local-certs/lan-server.key', import.meta.url))
const https = existsSync(certificatePath) && existsSync(keyPath)
  ? { cert: readFileSync(certificatePath), key: readFileSync(keyPath) }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    ...(https ? { https } : {}),
  },
})

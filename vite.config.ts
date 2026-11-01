import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiDevServerPlugin } from './api/_lib/devServer'

export default defineConfig(({ mode }) => {
  // Vite only forwards VITE_-prefixed vars to process.env by default; the
  // api/_lib/devServer.ts middleware needs the server-only ones too (DATABASE_URL etc).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), apiDevServerPlugin()],
  }
})

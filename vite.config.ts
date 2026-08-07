import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Dev-only: inject the platform `window.gt` runtime so Sprouts runs standalone
// (`pnpm dev`) against a local in-browser workspace (IndexedDB + cross-tab sync).
// In production General Text injects the runtime itself, so this never ships.
// Point GT_ORIGIN at a local worker if you run General Text locally.
function gtRuntime(): Plugin {
  const origin = process.env.GT_ORIGIN || 'https://www.generaltext.org'
  return {
    name: 'gt-runtime',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace('</head>', `<script src="${origin}/__gt/runtime.js"></script></head>`),
  }
}

export default defineConfig({
  build: {
    // Ship readable code. The published bytes are what a person forking this app,
    // or an agent asked to change it, has to work from — a minified bundle can be
    // run but not read, fixed, or continued.
    minify: false,
    // No sourcemap: a separate .js.map is never published (the install crawler only
    // fetches assets/* referenced from index.html), and inlining the sources would
    // multiply the bundle that lands in every installing workspace.
    sourcemap: false,
  },
  base: './',
  plugins: [react(), tailwindcss(), gtRuntime()],
  resolve: {
    alias: { '~': resolve(__dirname, 'src') },
  },
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
})

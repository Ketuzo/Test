import { defineConfig } from '#q-app/wrappers'
import dotenv from 'dotenv'
import fs from 'node:fs'
import { resolve as r } from 'node:path'

dotenv.config()

export default defineConfig(() => ({

  // Boot-Dateien
  boot: [
    'pinia',
    'axios',
    'vueflow' // Boot-File importiert die VueFlow-CSS (siehe Hinweis unten)
  ],

  // Globale CSS
  css: [
    'node-styles.css',
    'app.scss'
  ],

  // Extras (Icon-Sets, Fonts)
  extras: [
    'roboto-font',
    'material-icons'
  ],

  // Build-Optionen
  build: {
    vueRouterMode: 'hash',

    extendViteConf (viteConf) {
      // ----- sql-wasm ins Bundle kopieren
      viteConf.plugins = viteConf.plugins || []
      viteConf.plugins.push({
        name: 'copy-sql-wasm',
        apply: 'build',
        generateBundle () {
          this.emitFile({
            type: 'asset',
            fileName: 'wasm/sql-wasm.wasm',
            source: fs.readFileSync(
              r(require.resolve('sql.js/dist/sql-wasm.wasm'))
            )
          })
        }
      })

      // ----- Alias '@' → ./src
      viteConf.resolve = viteConf.resolve || {}
      if (Array.isArray(viteConf.resolve.alias)) {
        viteConf.resolve.alias = Object.fromEntries(
          viteConf.resolve.alias.map(a => [a.find, a.replacement])
        )
      }
      viteConf.resolve.alias = {
        ...(viteConf.resolve.alias || {}),
        '@': r('./src')
      }

      // (Optional) VueFlow-Pakete vor-bundlen – verhindert gelegentliche HMR-Warnungen
      viteConf.optimizeDeps = viteConf.optimizeDeps || {}
      viteConf.optimizeDeps.include = [
        ...(viteConf.optimizeDeps.include || []),
        '@vue-flow/core',
        '@vue-flow/controls',
        '@vue-flow/minimap',
        '@vue-flow/background'
      ]
    }
  },

  // Dev-Server
  devServer: {
    port: 9001,
    host: 'localhost',
    strictPort: true,
    open: false,
    // stabileres HMR (fix für frühere WS-Fehler)
    hmr: { protocol: 'ws', host: 'localhost', port: 9001 },

    proxy: {
      '/api': {
        target: process.env.VITE_API_URL,
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  },

  // Quasar Framework
  framework: {
    config: {},
    // WICHTIG: Notify & Dialog aktivieren (du nutzt beide)
    plugins: ['Notify', 'Dialog']
  },

  animations: []
}))

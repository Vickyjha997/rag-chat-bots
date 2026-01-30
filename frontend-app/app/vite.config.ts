import { defineConfig, Plugin, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'fs'
import { transform } from 'esbuild'

// Plugin to serve loader.ts as loader.js in development by transpiling with esbuild
// Also injects .env values as defaults
function loaderDevPlugin(): Plugin {
  return {
    name: 'loader-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/loader.js' || req.url?.startsWith('/loader.js')) {
          try {
            // Load .env file
            const env = loadEnv('development', __dirname, '')
            
            // Read the TypeScript file
            const loaderPath = path.resolve(__dirname, 'src/loader.ts')
            let loaderContent = fs.readFileSync(loaderPath, 'utf-8')
            
            // Inject .env values as constants before transpilation
            const envDefaults = `
  // Injected from .env file at build time
  const ENV_DEFAULTS = {
    apiBase: ${JSON.stringify(env.VITE_API_BASE_URL || '')},
    voiceHttpBase: ${JSON.stringify(env.VITE_VOICE_HTTP_BASE_URL || '')},
    voiceWsBase: ${JSON.stringify(env.VITE_VOICE_WS_BASE_URL || '')},
  };
`
            
            // Remove any import.meta.env usage first (before injecting ENV_DEFAULTS)
            loaderContent = loaderContent.replace(
              /\(import\.meta as any\)\.env\.VITE_API_BASE_URL/g,
              'ENV_DEFAULTS.apiBase'
            )
            loaderContent = loaderContent.replace(
              /\(import\.meta as any\)\.env\.VITE_VOICE_HTTP_BASE_URL/g,
              'ENV_DEFAULTS.voiceHttpBase'
            )
            loaderContent = loaderContent.replace(
              /\(import\.meta as any\)\.env\.VITE_VOICE_WS_BASE_URL/g,
              'ENV_DEFAULTS.voiceWsBase'
            )
            // Also handle without 'as any'
            loaderContent = loaderContent.replace(
              /import\.meta\.env\.VITE_API_BASE_URL/g,
              'ENV_DEFAULTS.apiBase'
            )
            loaderContent = loaderContent.replace(
              /import\.meta\.env\.VITE_VOICE_HTTP_BASE_URL/g,
              'ENV_DEFAULTS.voiceHttpBase'
            )
            loaderContent = loaderContent.replace(
              /import\.meta\.env\.VITE_VOICE_WS_BASE_URL/g,
              'ENV_DEFAULTS.voiceWsBase'
            )
            
            // Insert env defaults after the strict mode declaration
            loaderContent = loaderContent.replace(
              '"use strict";',
              `"use strict";${envDefaults}`
            )
            
            // Update the apiBase line to use ENV_DEFAULTS (handle various patterns)
            loaderContent = loaderContent.replace(
              /const envApiBase = .*?;/g,
              '// envApiBase replaced with ENV_DEFAULTS'
            )
            loaderContent = loaderContent.replace(
              /const apiBase = scriptEl\.getAttribute\("data-api-base"\) \|\| envApiBase;/,
              `const apiBase = scriptEl.getAttribute("data-api-base") || ENV_DEFAULTS.apiBase || window.location.origin;`
            )
            loaderContent = loaderContent.replace(
              /const apiBase = scriptEl\.getAttribute\("data-api-base"\) \|\| window\.location\.origin;/,
              `const apiBase = scriptEl.getAttribute("data-api-base") || ENV_DEFAULTS.apiBase || window.location.origin;`
            )
            
            // Update voice config to use ENV_DEFAULTS
            loaderContent = loaderContent.replace(
              /voiceHttpBase: scriptEl\.getAttribute\("data-voice-http-base"\) \|\| "",/,
              `voiceHttpBase: scriptEl.getAttribute("data-voice-http-base") || ENV_DEFAULTS.voiceHttpBase || "",`
            )
            loaderContent = loaderContent.replace(
              /voiceWsBase: scriptEl\.getAttribute\("data-voice-ws-base"\) \|\| "",/,
              `voiceWsBase: scriptEl.getAttribute("data-voice-ws-base") || ENV_DEFAULTS.voiceWsBase || "",`
            )
            
            // Transpile TypeScript to JavaScript using esbuild
            const result = await transform(loaderContent, {
              loader: 'ts',
              format: 'iife',
              target: 'es2015',
            })
            
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(result.code)
            return
          } catch (error) {
            console.error('[Vite] Error serving loader.js:', error)
            res.statusCode = 500
            res.end(`console.error('Failed to load loader.js: ${error}');`)
            return
          }
        }
        next()
      })
    },
  }
}

// Plugin to inject .env values into loader during build
function injectEnvBuildPlugin(): Plugin {
  return {
    name: 'inject-env-build-plugin',
    transform(code, id) {
      if (id.includes('loader.ts') && id.endsWith('.ts')) {
        // Load .env file
        const env = loadEnv(process.env.NODE_ENV || 'production', __dirname, '')
        
        // Inject .env values as constants
        const envDefaults = `
  // Injected from .env file at build time
  const ENV_DEFAULTS = {
    apiBase: ${JSON.stringify(env.VITE_API_BASE_URL || '')},
    voiceHttpBase: ${JSON.stringify(env.VITE_VOICE_HTTP_BASE_URL || '')},
    voiceWsBase: ${JSON.stringify(env.VITE_VOICE_WS_BASE_URL || '')},
  };
`
        
        let modifiedCode = code.replace(
          '"use strict";',
          `"use strict";${envDefaults}`
        )
        
        // Update to use ENV_DEFAULTS
        modifiedCode = modifiedCode.replace(
          /const apiBase = scriptEl\.getAttribute\("data-api-base"\) \|\| window\.location\.origin;/,
          `const apiBase = scriptEl.getAttribute("data-api-base") || ENV_DEFAULTS.apiBase || window.location.origin;`
        )
        
        modifiedCode = modifiedCode.replace(
          /voiceHttpBase: scriptEl\.getAttribute\("data-voice-http-base"\) \|\| "",/,
          `voiceHttpBase: scriptEl.getAttribute("data-voice-http-base") || ENV_DEFAULTS.voiceHttpBase || "",`
        )
        modifiedCode = modifiedCode.replace(
          /voiceWsBase: scriptEl\.getAttribute\("data-voice-ws-base"\) \|\| "",/,
          `voiceWsBase: scriptEl.getAttribute("data-voice-ws-base") || ENV_DEFAULTS.voiceWsBase || "",`
        )
        
        return { code: modifiedCode, map: null }
      }
    },
  }
}

// Dev proxy target: backend on 3000 (local) or 40000 (Docker on host)
const apiBase = loadEnv('development', __dirname, '').VITE_API_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), loaderDevPlugin(), injectEnvBuildPlugin()],
  server: {
    port: 5173,
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws',
    },
    proxy: {
      // Proxy API requests to the backend (uses VITE_API_BASE_URL from .env / .env_file)
      '/api': {
        target: apiBase,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Build to dist folder - frontend runs separately
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        iframe: path.resolve(__dirname, 'iframe.html'),
        demo: path.resolve(__dirname, 'demo.html'),
        loader: path.resolve(__dirname, 'src/loader.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'loader' ? 'loader.js' : 'assets/[name]-[hash].js'
        },
      },
    },
    assetsDir: 'assets',
  },
})


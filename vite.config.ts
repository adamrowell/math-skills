import { defineConfig, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * transformers.js references onnxruntime's 27 MB "asyncify" WASM as its default runtime. We always
 * point the runtime at the 14 MB build copied into public/ort/ (see src/voice/engines/asr.worker.ts,
 * `wasmPaths`), so the asyncify file is never fetched. Drop it from dist to keep the Pages
 * artifact small. (Only the dev-only `?asrDevice=webgpu` override would need it.)
 */
function dropUnusedOrtWasm(): Plugin {
  return {
    name: 'drop-unused-ort-wasm',
    apply: 'build',
    generateBundle(_opts, bundle) {
      for (const name of Object.keys(bundle)) {
        if (/ort-wasm-simd-threaded\.(asyncify|jsep|jspi)[^/]*\.wasm$/.test(name)) delete bundle[name]
      }
    },
  }
}

// Relative base: the built app works at any path (GitHub Pages /<repo>/, a subfolder, or root).
// Routing is hash-based (#/multiplication), so no 404 fallback is needed on Pages.
// VITE_HTTPS=1 npm run dev → https dev server with a self-signed cert, so the mic works when
// testing from a phone/iPad on the same network (browsers only allow the mic on secure origins).
export default defineConfig(() => {
  const https = process.env.VITE_HTTPS === '1'
  const plugins: PluginOption[] = [react(), dropUnusedOrtWasm()]
  if (https) plugins.push(basicSsl())
  return {
    plugins,
    base: './',
    server: {
      port: 5183,
      host: https ? true : undefined,
    },
    worker: {
      format: 'es' as const,
      plugins: () => [dropUnusedOrtWasm()],
    },
    optimizeDeps: {
      // transformers.js ships its own WASM/worker loading; let Vite serve it untouched in dev.
      exclude: ['@huggingface/transformers'],
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/@huggingface/transformers') || id.includes('node_modules/onnxruntime')) {
              return 'transformers'
            }
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
            return undefined
          },
        },
      },
    },
  }
})

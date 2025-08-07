import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry point
        entry: 'src/main.js',
        onstart(options) {
          // Restart electron app when main process is updated
          options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              input: {
                main: 'src/main.js',
                transcription: 'src/transcription.js',
                llm: 'src/llm.js'
              },
              output: {
                format: 'cjs',
                entryFileNames: '[name].js'
              },
              external: [
                'electron',
                'path',
                'fs',
                'os',
                'util',
                'events',
                'buffer',
                'stream',
                'url',
                'assert',
                'crypto',
                'net',
                'tls',
                'zlib',
                'http',
                'https',
                'child_process',
                'openai',
                'fluent-ffmpeg',
                'ffmpeg-static',
                'node-llama-cpp',
                'nodejs-whisper',
                'follow-redirects',
                'marked'
              ],
            },
          },
        },
      },
      {
        // Preload script entry point
        entry: 'src/preload.js',
        onstart(options) {
          // Reload the renderer when preload script is updated
          options.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'dist-electron',
            lib: {
              entry: 'src/preload.js',
              formats: ['cjs'],
              fileName: () => 'preload.js'
            },
            rollupOptions: {
              external: [
                'electron',
                'path',
                'fs',
                'os'
              ],
            },
          },
        },
      }
    ]),
    // Use electron renderer in development
    renderer(),
  ],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  },
  base: './'
})
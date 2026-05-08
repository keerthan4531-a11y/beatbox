import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // Proxy JioSaavn API requests to bypass CORS
      '/saavn-proxy': {
        target: 'https://jiosaavn-api.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/saavn-proxy/, ''),
        secure: true,
      },
    },
  },
})

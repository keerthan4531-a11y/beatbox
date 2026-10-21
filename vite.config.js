import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
    proxy: {
      // Proxy JioSaavn API via Cloudflare Worker (saavn.dev is DNS-blocked by some ISPs)
      '/saavn-api': {
        target: 'https://weathered-heart-9c50.fct197096.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/saavn-api/, ''),
        secure: true,
      },
      // Proxy YouTube directly (since Piped instances are down globally)
      '/youtube-api': {
        target: 'https://www.youtube.com', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/youtube-api/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      // Proxy YouTube Proxy Router
      '/api/yt': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },

      // Proxy TMDB API
      '/tmdb-api': {
        target: 'https://api.themoviedb.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tmdb-api/, ''),
        secure: true,
      },
    },
  },
})

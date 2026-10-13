import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
          // Canonical dev mapping for the server's Path=/auth/ refresh
          // cookie: the browser matches cookie paths against the pre-proxy
          // URL (/api/…), so without this rewrite the cookie is never sent.
          cookiePathRewrite: {
            '/auth/': '/api/auth/',
            '/auth/github': '/api/auth/github',
            '/auth/discord': '/api/auth/discord',
            '/': '/',
          },
        },
      },
    },
  };
});

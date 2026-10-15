import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      watch: { awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 } },
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          secure: env.API_PROXY_ALLOW_SELF_SIGNED !== 'true',
          rewrite: (path) => (env.API_PROXY_PREFIX || '') + path.replace(/^\/api(?=\/|$)/, ''),
          cookiePathRewrite: '/',
        },
      },
    },
  };
});

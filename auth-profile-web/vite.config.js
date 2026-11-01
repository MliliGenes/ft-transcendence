import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target:
            process.env.API_PROXY_TARGET ||
            env.API_PROXY_TARGET ||
            'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
          cookiePathRewrite: '/',
        },
        '^/chat/': {
          target:
            process.env.CHAT_PROXY_TARGET ||
            env.CHAT_PROXY_TARGET ||
            'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target:
            process.env.CHAT_PROXY_TARGET ||
            env.CHAT_PROXY_TARGET ||
            'http://localhost:3001',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});

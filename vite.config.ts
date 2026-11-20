import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，构建产物可直接丢到 OSS 任意子目录或 GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // 默认只绑 IPv6 回环（[::1]），浏览器走 IPv4 解析 localhost 时会连不上，
    // 这里显式监听所有网卡，127.0.0.1 和 localhost 都能开
    host: true,
    port: 5180,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

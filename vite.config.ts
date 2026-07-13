import { defineConfig } from 'vite';

export default defineConfig({
  // 相対パスでビルドする: どこに置いても(GitHub Pages等)動くようにする
  base: './',
  build: {
    target: 'es2022',
  },
  server: {
    host: true,
  },
});

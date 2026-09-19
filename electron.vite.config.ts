import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  renderer: {
    // 显式绑到 IPv4：默认的 'localhost' 在 Windows 上会解析成 ::1，
    // vite 于是只监听 [::1]:5173，而 Electron 请求 localhost 时解析到
    // 127.0.0.1，结果是 ERR_CONNECTION_REFUSED
    server: { host: '127.0.0.1' },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
  },
})

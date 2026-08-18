import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  root: import.meta.dirname,   // web/ 自身是 root（Node ≥20.11；本机 Node 24）
  // @agent-lite/core 经工作区软链指向 TS 源；若 dev 报 bare-import 解析/预打包错，开启：
  // optimizeDeps: { include: ['@agent-lite/core'] },
})

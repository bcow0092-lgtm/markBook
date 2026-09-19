import { contextBridge } from 'electron'

// M1 阶段先只验证桥接通道可用，真正的白名单 API 在 Task 3 之后补
contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',
})

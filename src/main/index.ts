import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerAppScheme, registerAppProtocol } from './protocol'
import { createContext } from './services/context'
import { registerLibraryIpc } from './ipc/library'
import { registerReaderIpc } from './ipc/reader'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    backgroundColor: '#F7F7F7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 开发模式下把渲染进程的 console 转发到 stdout。CSP 违规、React 报错
  // 这类信息只出现在 DevTools 里，不转发的话在终端完全看不见。
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.on('console-message', (details) => {
      console.log(`[renderer:${details.level}] ${details.message}`)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 必须在 app ready 之前注册 scheme 的特权
registerAppScheme()

// 单实例锁不是体验优化，是数据正确性的前提（技术方案 §2.3）：
// 本方案是「内存持有全量 + 防抖落盘」，两个实例会各持一份 library.json
// 并互相覆盖。
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    // 建目录、清 staging、加载书架数据，一站式
    const ctx = await createContext(app.getPath('userData'))
    registerAppProtocol(ctx.paths.root)
    registerLibraryIpc(ctx)
    registerReaderIpc(ctx)
    createWindow()

    // 仓储是「内存持有 + 防抖落盘」（§4.3），不拦这一下的话，退出前最后
    // 几秒的改动会随进程一起消失。before-quit 是同步的，不能直接 await，
    // 走「拦一次 → 落盘 → 再退」。
    let flushed = false
    app.on('before-quit', (event) => {
      if (flushed) return
      event.preventDefault()
      void ctx.repo.flush().finally(() => {
        flushed = true
        app.quit()
      })
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

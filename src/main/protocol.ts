import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { resolveAppPath } from './services/appPath'

const forbidden = (): Response => new Response(null, { status: 403 })

/** 必须在 app ready 之前调用 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        // 缺了这一项，渲染进程 fetch('app://...') 会被 Chromium 的 CORS
        // 直接拒掉，报「Cross origin requests are only supported for
        // protocol schemes: chrome, chrome-extension, ...」。
        // epub.js 内部走 XHR，同样会被拦，书完全加载不出来。
        corsEnabled: true,
      },
    },
  ])
}

/** 必须在 app ready 之后调用 */
export function registerAppProtocol(appDataDir: string): void {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const abs = resolveAppPath(appDataDir, pathname)
    if (!abs) return forbidden()
    return net.fetch(pathToFileURL(abs).toString())
  })
}

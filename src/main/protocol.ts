import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { resolveAppPath } from './services/appPath'

const forbidden = (): Response => new Response(null, { status: 403 })

/** 必须在 app ready 之前调用 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
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

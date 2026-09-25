import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { ReadingProgress } from '@shared/types'
import type { AppContext } from '../services/context'
import { readLocations, writeLocations } from '../services/locations'

/** reader:* 通道的接线层。业务在 services 里，这边只做转发。 */
export function registerReaderIpc(ctx: AppContext): void {
  ipcMain.handle(IPC.locationsGet, (_e, id: string) => readLocations(ctx, id))
  ipcMain.handle(IPC.locationsSave, (_e, id: string, json: string) => writeLocations(ctx, id, json))

  ipcMain.handle(IPC.progressSave, async (_e, id: string, progress: ReadingProgress) => {
    const book = ctx.repo.listBooks().find((b) => b.id === id)
    if (!book) return
    // lastReadAt 是书架排序的依据（§3.2），每次落进度都要带上
    await ctx.repo.upsertBook({ ...book, progress, lastReadAt: Date.now() })
  })
}

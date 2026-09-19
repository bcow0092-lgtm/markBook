import { dialog, ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { Book, CommitPayload, ImportResult } from '@shared/types'
import type { AppContext } from '../services/context'
import {
  abortImport,
  commitImport,
  deleteBook,
  importStaged,
} from '../services/library'

/**
 * books:* 通道的接线层。
 *
 * 这里只做「弹对话框 + 转发到 services/library」——业务逻辑全在
 * services 里，那边不 import electron，因而可以在 vitest 的 Node 环境下
 * 直接测。这也是 M1 定下的分层规矩。
 */
export function registerLibraryIpc(ctx: AppContext): void {
  ipcMain.handle(IPC.booksList, (): Book[] => ctx.repo.listBooks())

  ipcMain.handle(IPC.booksImport, async (): Promise<ImportResult | null> => {
    const picked = await dialog.showOpenDialog({
      title: '选择要导入的书',
      properties: ['openFile'],
      filters: [{ name: '电子书', extensions: ['epub', 'txt'] }],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    return importStaged(ctx, picked.filePaths[0])
  })

  ipcMain.handle(IPC.booksCommit, (_e, id: string, payload: CommitPayload) =>
    commitImport(ctx, id, payload),
  )

  ipcMain.handle(IPC.booksAbort, (_e, id: string) => abortImport(ctx, id))

  ipcMain.handle(IPC.booksDelete, async (_e, id: string): Promise<void> => {
    const book = ctx.repo.listBooks().find((b) => b.id === id)
    if (!book) return

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['删除', '取消'],
      defaultId: 1,
      cancelId: 1,
      message: `确定删除《${book.title}》？`,
      detail: '书籍文件与阅读进度都会被移除，无法恢复。',
    })
    if (response === 0) await deleteBook(ctx, id)
  })
}

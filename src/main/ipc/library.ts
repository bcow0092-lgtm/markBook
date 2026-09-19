import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { Book } from '@shared/types'
import type { AppContext } from '../services/context'

/**
 * books:* 通道的 handler。
 *
 * 目前只实现 books:list —— 它足以验证「组合根 → 仓储 → IPC → 渲染进程」
 * 这条链路是通的。导入、提交、回滚与删除在 M2 的 Task 4 补上。
 */
export function registerLibraryIpc(ctx: AppContext): void {
  ipcMain.handle(IPC.booksList, (): Book[] => ctx.repo.listBooks())
}

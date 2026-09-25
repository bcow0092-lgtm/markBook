import type { Book } from '@shared/types'

/**
 * 书架默认排序（技术方案 §3.2）：读过的按最后阅读时间降序在前，没读过的
 * 按加入时间降序在后。
 *
 * `lastReadAt` 为 null 就是没读过，它无论 addedAt 多新都要排到读过的后面
 * —— 否则刚导入一本书就会把正在读的挤下去。
 */
export function sortByRecentRead(books: Book[]): Book[] {
  return [...books].sort((a, b) => {
    const aRead = a.lastReadAt
    const bRead = b.lastReadAt
    if (aRead !== null && bRead !== null) return bRead - aRead
    if (aRead !== null) return -1
    if (bRead !== null) return 1
    return b.addedAt - a.addedAt
  })
}

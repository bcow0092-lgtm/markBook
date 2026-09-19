import { resolve, join, sep } from 'node:path'

/** 技术方案 §5.1：只有这些顶层目录可以被 app:// 访问 */
export const ALLOWED_DIRS = ['books', 'txt-cache', 'chapters', 'covers', 'locations'] as const

/**
 * 把 app:// 请求的 pathname 解析成 appData 下的绝对路径。
 * 解析失败、越出白名单、或指向目录本身时返回 null。
 *
 * 注意解码必须发生在校验之前 —— 否则 %2e%2e 这类编码可以绕过检查。
 */
export function resolveAppPath(appDataDir: string, urlPathname: string): string | null {
  let rel: string
  try {
    rel = decodeURIComponent(urlPathname)
  } catch {
    return null // 非法百分号编码
  }

  if (rel.includes('\0')) return null

  rel = rel.replace(/^\/+/, '')
  if (rel === '') return null

  const top = rel.split('/')[0]
  if (!(ALLOWED_DIRS as readonly string[]).includes(top)) return null

  const abs = resolve(appDataDir, rel)

  // 规范化之后必须仍落在对应的白名单目录「内部」。
  // 末尾的 sep 是关键：没有它，books-evil/ 会被误判为在 books/ 下。
  if (!abs.startsWith(join(appDataDir, top) + sep)) return null

  return abs
}

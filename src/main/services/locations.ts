import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppContext } from './context'

/**
 * id 是主进程自己生成的 uuid，正常不会带路径分隔符。但仍然校验 —— 这个
 * 函数会拿它拼路径，一旦上游哪天改成用书名之类的东西当 id，拼出来就会
 * 穿越到 locations/ 之外。
 */
function assertSafeId(id: string): void {
  if (
    id === '' ||
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('..') ||
    id.includes('\0')
  ) {
    throw new Error(`非法的书籍 id：${JSON.stringify(id)}`)
  }
}

const fileOf = (ctx: AppContext, id: string): string => {
  assertSafeId(id)
  return join(ctx.paths.locations, `${id}.json`)
}

/** 读位置索引。尚未生成时返回 null —— 这是正常状态，不是错误。 */
export async function readLocations(ctx: AppContext, id: string): Promise<string | null> {
  // fileOf 放在 try 外面：非法 id 应当抛错，不能被下面的 catch 吞成
  // 「这本书没有索引」
  const file = fileOf(ctx, id)
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

export async function writeLocations(ctx: AppContext, id: string, json: string): Promise<void> {
  const file = fileOf(ctx, id)
  await mkdir(ctx.paths.locations, { recursive: true })
  await writeFile(file, json, 'utf8')
}

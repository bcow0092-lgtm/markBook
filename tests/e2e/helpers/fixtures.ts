import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import iconv from 'iconv-lite'
import { REPO_ROOT } from './app'

/** tests/fixtures/ 下的样本，都是提交进仓库的（§6.4） */
export const FIXTURES = {
  epub: join(REPO_ROOT, 'tests', 'fixtures', 'sample-gutenberg.epub'),
  wideTable: join(REPO_ROOT, 'tests', 'fixtures', 'wide-table.epub'),
} as const

/**
 * 样本 TXT 不入库 —— GBK 编码的小文件用脚本现造比提交二进制更清楚，
 * 名字以 `.generated-` 开头，已在 .gitignore 里。
 */
export const GBK_TXT = join(REPO_ROOT, 'tests', 'fixtures', '.generated-gbk.txt')

/** 中文排版常见的段首缩进（两个全角空格 U+3000）。用转义是因为
 * eslint 的 no-irregular-whitespace 会拦下直接写在源码里的全角空格 */
const INDENT = '　　'

/**
 * 确保 GBK 样本存在。
 *
 * **必须由测试自己保证**，不能依赖某个先跑过的手工步骤：这个文件是
 * gitignore 的，CI 上从来不存在 —— 第一次跑 CI 就栽在这里，表现为
 * 「打开《」按钮一直不出现（因为导入的是一个不存在的路径）。
 */
export function ensureGbkFixture(): void {
  if (existsSync(GBK_TXT)) return

  let text = ''
  for (let i = 1; i <= 8; i++) {
    text += `第${i}章 测试章节${i}\n\n`
    for (let j = 0; j < 10; j++) {
      text += `${INDENT}这是第${i}章的第${j + 1}段中文正文，用于验证 GBK 转码后不乱码。\n\n`
    }
  }

  writeFileSync(GBK_TXT, iconv.encode(text, 'GBK'))
}

import { join } from 'node:path'
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

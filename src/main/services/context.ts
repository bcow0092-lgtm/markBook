import { createPaths, ensureDirs, clearStaging, type AppPaths } from './paths'
import { createRepository, type Repository } from './repository'
import { createBookFiles, type BookFiles } from './bookFiles'

export interface AppContext {
  paths: AppPaths
  repo: Repository
  files: BookFiles
}

/**
 * 组合根。把三个服务用同一个 root 实例化并接起来。
 *
 * 服务本身都不 import electron，root 由调用方（main/index.ts 用
 * app.getPath('userData')）传入，因此这里可以在 vitest 的 Node 环境下
 * 直接跑，不需要 mock electron。
 */
export async function createContext(root: string): Promise<AppContext> {
  const paths = createPaths(root)
  await ensureDirs(paths)
  // 清掉上次运行中途崩溃留下的半成品（技术方案 §5.6）
  await clearStaging(paths)

  const repo = createRepository(paths.libraryFile)
  await repo.load()

  return { paths, repo, files: createBookFiles(paths) }
}

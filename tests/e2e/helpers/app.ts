import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Book, LibraryData } from '../../../src/shared/types'

// 用 __dirname 而不是 import.meta.url：package.json 没有 "type": "module"，
// Playwright 把测试编译成 CJS，import.meta 在运行时不存在
export const REPO_ROOT = join(__dirname, '..', '..', '..')

export interface TestApp {
  app: ElectronApplication
  page: Page
  /** 隔离出来的 appData 目录 */
  dataDir: string
  /** 让下一次「导入」直接用这个文件，不走原生对话框 */
  willImport(filePath: string): Promise<void>
  /** 让确认对话框一律点「确定」（删除确认用的是它） */
  alwaysConfirm(): Promise<void>
  /** 读 library.json */
  readLibrary(): Promise<LibraryData>
  findBook(id: string): Promise<Book | undefined>
  close(): Promise<void>
}

export interface LaunchOptions {
  /** 复用已有目录（测「重启后还在」这类场景时传上一次的） */
  dataDir?: string
  /** true 时不删目录，方便失败后翻现场 */
  keepDataDir?: boolean
}

export async function launchApp(opts: LaunchOptions = {}): Promise<TestApp> {
  const dataDir = opts.dataDir ?? (await mkdtemp(join(tmpdir(), 'mark-reader-e2e-')))

  const app = await electron.launch({
    cwd: REPO_ROOT,
    args: [
      '.',
      // 隔离 appData：不加这个，测试会读写用户的真实书架
      `--user-data-dir=${dataDir}`,
      // CI 的 Windows runner 上显卡相关的偶发超时（§6.5）
      '--disable-gpu',
    ],
  })

  const page = await app.firstWindow()

  // 把渲染进程的 console 与未捕获错误转出来。E2E 失败时最需要的往往就是
  // 这几行 —— 没有它，断言失败时只剩一个「元素没出现」，无从下手
  page.on('console', (m) => console.log(`[renderer:${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))

  await page.waitForLoadState('domcontentloaded')

  const readLibrary = async (): Promise<LibraryData> =>
    JSON.parse(await readFile(join(dataDir, 'library.json'), 'utf8')) as LibraryData

  return {
    app,
    page,
    dataDir,
    readLibrary,

    async willImport(filePath) {
      // 主进程里直接换掉对话框实现。原生对话框 Playwright 点不了，
      // 但 electronApp.evaluate 能在主进程里执行任意代码
      await app.evaluate(({ dialog }, p) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
      }, filePath)
    },

    async alwaysConfirm() {
      // 删除确认走的是 showMessageBox，response 0 是第一个按钮（「删除」）
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
      })
    },

    async findBook(id) {
      const lib = await readLibrary().catch(() => null)
      return lib?.books.find((b) => b.id === id)
    },

    async close() {
      await app.close()
      if (!opts.keepDataDir) await rm(dataDir, { recursive: true, force: true })
    },
  }
}

/**
 * 等某个文件出现。
 *
 * `library.json` 是防抖写的（§4.3），测试里读它之前需要等一下。
 * 返回书架或退出阅读页时主进程会 flush，所以多数场景不用等太久。
 */
export async function waitForFile(path: string, timeoutMs = 5_000): Promise<void> {
  const started = Date.now()
  for (;;) {
    try {
      await readFile(path)
      return
    } catch {
      if (Date.now() - started > timeoutMs) throw new Error(`等待超时：${path}`)
      await new Promise((r) => setTimeout(r, 50))
    }
  }
}

/**
 * 等书真正渲染出来。
 *
 * **不能只等 `progress-label`**：那是进度条里的元素，书还没加载完它就已经在
 * 了。这时候按翻页键是白按 —— 引擎还没就绪，`relocated` 不会触发。
 *
 * **也不能等正文容器**（EPUB 的 iframe / TXT 的 `.txt-columns`）：容器建出来
 * 时 `display()` 可能还没跑完，同样会漏按键。
 *
 * **更不能等章节名**：起始页的章节名本来就是空的（第一条 spine 通常是封面
 * 或版权页，它不在目录里，findCurrentChapter 返回空是正确的）。
 *
 * 所以等阅读页的 `aria-busy` 落到 false —— 引擎的 `load()` 承诺「内容已经
 * 渲染出来」，阅读页就是在那时解除忙碌的。
 */
export async function waitBookLoaded(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.locator('[aria-busy="false"]').waitFor({ state: 'attached', timeout: timeoutMs })
}

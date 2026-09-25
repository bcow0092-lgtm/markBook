import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { launchApp, waitBookLoaded, waitForFile } from './helpers/app'
import { FIXTURES } from './helpers/fixtures'

test('导入一本 EPUB → 书架出现该书，封面/书名/作者正确', async () => {
  const app = await launchApp()
  try {
    await app.willImport(FIXTURES.epub)
    await app.page.getByRole('button', { name: /导入第一本书/ }).click()

    // 书名与作者来自 epub.js 解析出的元数据
    await expect(app.page.getByText('Pride and Prejudice')).toBeVisible({ timeout: 30_000 })
    await expect(app.page.getByText('Jane Austen')).toBeVisible()

    // 封面是真实渲染出来的 img，不是书名首字占位
    await expect(app.page.getByTestId('cover').first()).toBeVisible()

    // 落盘：library.json 里有这本书
    await waitForFile(join(app.dataDir, 'library.json'))
    const lib = await app.readLibrary()
    expect(lib.books).toHaveLength(1)
    expect(lib.books[0].title).toBe('Pride and Prejudice')
    expect(lib.books[0].author).toBe('Jane Austen')
    expect(lib.books[0].coverFileName).toBeTruthy()
  } finally {
    await app.close()
  }
})

test('打开 → 翻三页 → 返回 → 重新打开 → 位置恢复', async () => {
  const app = await launchApp()
  try {
    // 先导入一本作为被测对象
    await app.willImport(FIXTURES.epub)
    await app.page.getByRole('button', { name: /导入第一本书/ }).click()
    await expect(app.page.getByText('Pride and Prejudice')).toBeVisible({ timeout: 30_000 })

    // 打开
    await app.page.getByRole('button', { name: /打开《Pride and Prejudice》/ }).click()
    await waitBookLoaded(app.page)
    await waitForFile(join(app.dataDir, 'library.json'))

    // 翻三页。
    // 先翻页是必须的：不翻的话「回到开头」也能骗过断言。
    // 用键盘而不是点热区 —— 热区位置依赖窗口尺寸，键盘是确定的。
    // 每次留 150ms 间隔：真实用户不会在几毫秒内连按三次，而 epub.js 在
    // 极密集的 next() 调用下会丢页（已单独记为待查项）
    for (let i = 0; i < 3; i++) {
      await app.page.keyboard.press('ArrowRight')
      await app.page.waitForTimeout(150)
    }

    // 等进度落盘（防抖 1s），记下此刻的位置
    await app.page.waitForTimeout(1500)
    const before = (await app.readLibrary()).books[0].progress
    expect(before).not.toBeNull()
    expect(before?.percentage).toBeGreaterThan(0)

    // 返回书架 —— ReaderPage 内部会先 flush 再退
    await app.page.getByRole('button', { name: '返回' }).click()
    await app.page.waitForTimeout(500)

    // 重新打开
    await app.page.getByRole('button', { name: /打开《Pride and Prejudice》/ }).click()
    await waitBookLoaded(app.page)
    await app.page.waitForTimeout(1000)

    // 位置必须与记下的那个完全一致 —— 这是本产品的核心承诺
    const after = (await app.readLibrary()).books[0].progress
    expect(after?.location).toBe(before?.location)
  } finally {
    await app.close()
  }
})

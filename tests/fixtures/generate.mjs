#!/usr/bin/env node
// 样本 EPUB 生成器（技术方案 §6.4）。
//
// 产物以二进制形式提交进仓库，本脚本留档但**不在 CI 中执行** —— 这样 CI
// 既不需要联网，也不需要 zip 写入依赖。
//
// 用法：
//   node tests/fixtures/generate.mjs <源 EPUB 路径>
//
// 源 EPUB 需要手工准备（公有领域书，例如 Project Gutenberg 的
// https://www.gutenberg.org/cache/epub/1342/pg1342.epub）。
// 已有的 sample-gutenberg.epub 就是这么来的。

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readZip, writeZip } from './zip.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = process.argv[2]
if (!src) {
  console.error('用法：node tests/fixtures/generate.mjs <源 EPUB 路径>')
  process.exit(1)
}

const source = readZip(readFileSync(src))
const find = (re) => source.filter((e) => re.test(e.name))
const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()
const asText = (e) => textDecoder.decode(e.data)
const asBuf = (s) => Buffer.from(textEncoder.encode(s))

const opfEntry = find(/\.opf$/)[0]
const contentDocs = find(/\.x?html?$/).filter((e) => !/nav|toc|cover/i.test(e.name))
if (!opfEntry) throw new Error('源 EPUB 里找不到 .opf')
if (contentDocs.length === 0) throw new Error('源 EPUB 里找不到正文文档')

/**
 * 重新打包。mimetype 必须排在第一个条目且不压缩 —— 这是 EPUB 规范要求，
 * 部分阅读器（包括 epub.js 的某些路径）会做这个检查。
 */
function repack(entries, outName) {
  const mimetype = entries.filter((e) => e.name === 'mimetype').map((e) => ({ ...e, store: true }))
  const rest = entries.filter((e) => e.name !== 'mimetype')
  if (mimetype.length !== 1) throw new Error('源 EPUB 缺少唯一的 mimetype 条目')
  writeFileSync(join(HERE, outName), writeZip([...mimetype, ...rest]))
  console.log(`  已生成 ${outName}`)
}

/** 把一段 HTML 插到某个正文文档的 </body> 之前 */
function injectIntoBody(entries, targetName, snippet) {
  return entries.map((e) => {
    if (e.name !== targetName) return e
    const html = asText(e)
    if (!html.includes('</body>')) throw new Error(`${targetName} 里没有 </body>`)
    return { ...e, data: asBuf(html.replace('</body>', `${snippet}</body>`)) }
  })
}

// 挑一个体积适中的正文文档做注入目标，避免落在封面页上
const target = contentDocs[Math.min(1, contentDocs.length - 1)]

// ---- 1. 超宽表格：必然溢出单页，是 epub.js 分页最常见的边界问题 ----
{
  const cols = 15
  const rows = 6
  const head = Array.from({ length: cols }, (_, i) => `<th>列${i + 1}</th>`).join('')
  const body = Array.from({ length: rows }, (_, r) =>
    `<tr>${Array.from({ length: cols }, (_, c) => `<td>数据 ${r + 1}-${c + 1}</td>`).join('')}</tr>`,
  ).join('')
  const table = `<div style="margin:2em 0"><h2>超宽表格</h2><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  repack(injectIntoBody(source, target.name, table), 'wide-table.epub')
}

// ---- 2. 大段内嵌图片：验证图片跨页与按需加载 ----
{
  // 1×1 的透明 PNG 重复 200 次，单个很小但数量多，足以压出跨页问题
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const imgs = Array.from(
    { length: 200 },
    (_, i) => `<p>图 ${i + 1}</p><img src="data:image/png;base64,${png}" width="120" height="120">`,
  ).join('')
  repack(injectIntoBody(source, target.name, `<div>${imgs}</div>`), 'many-images.epub')
}

// ---- 3. 中英混排 + 代码块 + 引用块 ----
{
  const snippet = `<div>
<h2>Mixed 中英混排 Testing</h2>
<p>这是一段中文，后面跟着 English text，再回到中文。数字 12345 与标点符号（，。！？）混排。</p>
<pre><code>function greet(name) {
  return \`Hello, \${name}! 你好，\${name}！\`
}</code></pre>
<blockquote><p>这是一段引用块，用来验证左边距与缩进在分页下的表现。</p></blockquote>
</div>`
  repack(injectIntoBody(source, target.name, snippet), 'mixed-cjk-latin.epub')
}

// ---- 4. 缺封面、缺作者：验证元数据兜底 ----
{
  const entries = source.map((e) => {
    if (e.name !== opfEntry.name) return e
    let opf = asText(e)
      .replace(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/g, '')
      .replace(/<meta[^>]*name="cover"[^>]*\/?>/g, '')
    return { ...e, data: asBuf(opf) }
  })
  repack(entries, 'no-cover-no-author.epub')
}

// ---- 5. 损坏的 OPF：验证容错 ----
{
  const entries = source.map((e) => {
    if (e.name !== opfEntry.name) return e
    return { ...e, data: asBuf(asText(e).slice(0, 200)) } // 直接截断
  })
  repack(entries, 'broken-opf.epub')
}

console.log('完成。')

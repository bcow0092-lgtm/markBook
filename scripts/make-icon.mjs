#!/usr/bin/env node
// 生成 electron-builder 用的 build/icon.ico。
//
// 为什么自己拼 ICO 而不找个库：ICO 就是个很薄的容器（一个头 + 每张图的目录项
// + 图片数据），Windows Vista 起支持直接把 PNG 塞进去。为这个引一个依赖不划算，
// 与 tests/fixtures/zip.mjs 同一个思路。
//
// 用法：node scripts/make-icon.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

const work = mkdtempSync(join(tmpdir(), 'mark-reader-icon-'))
try {
  console.log('渲染 PNG…')
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(HERE, 'render-icon.ps1'), '-OutDir', work],
    { stdio: 'inherit' },
  )

  const images = SIZES.map((size) => {
    const file = join(work, `icon_${size}.png`)
    if (!existsSync(file)) throw new Error(`缺少 ${file}`)
    return { size, data: readFileSync(file) }
  })

  // ICONDIR：保留位(2) + 类型(2，1 表示图标) + 张数(2)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  // ICONDIRENTRY 每张 16 字节；图片数据紧跟在目录之后
  let offset = 6 + images.length * 16
  const entries = []
  for (const { size, data } of images) {
    const e = Buffer.alloc(16)
    // 宽高各一字节，256 要写 0 —— 这个字段放不下 256
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // 调色板数量，真彩图为 0
    e.writeUInt8(0, 3) // 保留位
    e.writeUInt16LE(1, 4) // 色彩平面
    e.writeUInt16LE(32, 6) // 位深
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += data.length
  }

  const outDir = join(ROOT, 'build')
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'icon.ico')
  writeFileSync(out, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]))
  console.log(`已生成 ${out}（${images.length} 个尺寸）`)
} finally {
  rmSync(work, { recursive: true, force: true })
}

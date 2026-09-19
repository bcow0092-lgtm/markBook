import jschardet from 'jschardet'
import iconv from 'iconv-lite'

export interface DecodeResult {
  text: string
  encoding: string
}

/** 只探测开头这么多字节。jschardet 对全书做统计没有额外收益，几十 MB 反而慢。 */
const DETECT_WINDOW = 64 * 1024

/**
 * jschardet 报出来的名字与 iconv-lite 接受的名字不完全一致。
 *
 * GB2312 的字符集是 GBK 的子集、GBK 又是 GB18030 的子集，一律上提到
 * GB18030 —— 用超集去解子集的字节永远安全，反过来会丢字符。
 */
function normalizeEncoding(name: string | undefined | null): string {
  if (!name) return 'UTF-8'
  const n = name.toUpperCase()
  if (n === 'GB2312' || n === 'GBK' || n === 'GB18030' || n === 'X-GBK') return 'GB18030'
  if (n === 'ASCII') return 'UTF-8'
  return name
}

export function detectEncoding(buf: Buffer): string {
  if (buf.length === 0) return 'UTF-8'
  // BOM 优先于统计检测
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'UTF-8'
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'UTF-16LE'
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'UTF-16BE'

  const result = jschardet.detect(buf.subarray(0, DETECT_WINDOW))
  return normalizeEncoding(result?.encoding)
}

export function decodeText(buf: Buffer, forcedEncoding?: string): DecodeResult {
  const encoding = forcedEncoding ?? detectEncoding(buf)
  const text = iconv.decode(buf, encoding)
  // iconv-lite 会把 BOM 解成 U+FEFF 留在正文开头。不剥掉的话，章节切分
  // 的三条正则都带 ^ 行首锚点，第一章的标题会被 BOM 顶掉而漏切。
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  return { text: stripped, encoding }
}

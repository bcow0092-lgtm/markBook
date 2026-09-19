/**
 * 需要传给 epub.js 主题系统的色值（技术方案 §5.3、§11.4）。
 *
 * CSS 侧的同类值在 styles.css 的 `@theme` 块里 —— Tailwind 4 的主题定义在
 * CSS 中，JS 拿不到，两处只能各存一份。改色时一起改。
 */
export const READER_COLORS = {
  background: '#f7f7f7',
  text: '#2b2b2b',
  muted: '#8a8a8a',
  accent: '#5b7fa6',
} as const

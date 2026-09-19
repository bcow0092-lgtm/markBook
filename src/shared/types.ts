export type BookFormat = 'epub' | 'txt'

export interface ReadingProgress {
  /** EPUB 用 CFI 字符串；TXT 用字符偏移量 */
  location: string | number
  /** 0 ~ 1 */
  percentage: number
  /** 百分比是精确值还是按章节序号估算，见技术方案 §5.5 */
  percentageExact: boolean
  chapterIndex: number
  chapterTitle: string
}

export interface Book {
  id: string
  title: string
  author: string
  format: BookFormat
  fileName: string
  coverFileName: string | null
  size: number
  addedAt: number
  lastReadAt: number | null
  progress: ReadingProgress | null
  /** TXT 原始编码，用于诊断与重新转码；EPUB 为 null */
  sourceEncoding: string | null
  /** EPUB 位置索引是否已生成；TXT 恒为 true */
  locationsReady: boolean
}

export interface ChapterIndex {
  title: string
  /** 该章起始字符偏移（含） */
  start: number
  /** 该章结束字符偏移（不含） */
  end: number
}

/** chapters/{id}.json 的内容 */
export interface ChapterFile {
  /** 全书总字符数，同时用于计算 TXT 阅读进度 */
  totalCharacters: number
  chapters: ChapterIndex[]
}

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  pageMargin: 'narrow' | 'medium' | 'wide'
}

export interface LibraryData {
  version: 1
  books: Book[]
  settings: ReaderSettings
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  pageMargin: 'medium',
}

export function createEmptyLibrary(): LibraryData {
  return {
    version: 1,
    books: [],
    settings: { ...DEFAULT_READER_SETTINGS },
  }
}

export const IPC = {
  booksList: 'books:list',
  booksImport: 'books:import',
  booksCommit: 'books:commit',
  booksAbort: 'books:abort',
  booksDelete: 'books:delete',
  progressSave: 'progress:save',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

/** 主进程完成 staging 后返回给渲染进程的信息（技术方案 §5.6 第 1 步） */
export interface ImportResult {
  id: string
  format: BookFormat
  /** TXT 检测到的原始编码；EPUB 为 null */
  sourceEncoding: string | null
}

/** 渲染进程解析完元数据后回传给主进程的提交载荷（技术方案 §5.6 第 2 步） */
export interface CommitPayload {
  title: string
  author: string
  /** 封面图片的 base64 内容，无封面时为 null */
  coverBase64: string | null
  /** 封面扩展名（png / jpg / gif），无封面时为 null */
  coverExt: string | null
  /** 仅 TXT：章节索引 */
  chapters: ChapterFile | null
}

/**
 * preload 通过 contextBridge 暴露给渲染进程的完整 API（技术方案 §2.1）。
 *
 * 契约定义在这里而不是从 src/preload 反推：preload 依赖 electron 与 Node
 * 类型，而渲染进程的 tsconfig.web.json 不含这些，跨项目 import 会失败。
 */
export interface MarkReaderApi {
  listBooks(): Promise<Book[]>
  /** 弹出文件选择对话框；用户取消时返回 null */
  importBook(): Promise<ImportResult | null>
  commitImport(id: string, payload: CommitPayload): Promise<Book>
  abortImport(id: string): Promise<void>
  deleteBook(id: string): Promise<void>
  saveProgress(id: string, progress: ReadingProgress): Promise<void>
  getSettings(): Promise<ReaderSettings>
  saveSettings(settings: ReaderSettings): Promise<void>
}

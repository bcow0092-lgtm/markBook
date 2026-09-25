import type { Book, ReaderSettings, ReadingProgress } from '@shared/types'
import type { IndexedTocEntry } from '../../lib/readerProgress'

export interface ReaderEngineCallbacks {
  onRelocated(progress: ReadingProgress): void
  /** 目录就绪时回调一次，供 UI 渲染目录面板 */
  onToc(entries: IndexedTocEntry[]): void
}

/**
 * 阅读引擎接口（技术方案 §5.7）。
 *
 * M3 只定义用得上的方法，不含 `applySettings` —— 字号/行距/页边距是 M5 的
 * 活，不交付一个里面是空壳的方法。`TxtEngine` 在 M4 实现同一套接口，届时
 * 上层阅读页不需要感知格式差异。
 */
export interface ReaderEngine {
  /** 加载书籍并恢复到指定位置；location 为 null 时从头开始 */
  load(book: Book, location: string | number | null): Promise<void>
  prev(): void
  next(): void
  goToChapter(index: number): void
  goToLocation(location: string | number): void
  /** 按全书百分比跳转；位置索引未就绪时退化为按章节比例粗跳 */
  goToPercentage(percentage: number): void
  /** 容器尺寸变化后重新分页 */
  resize(): void
  /**
   * 应用阅读设置（§5.3）。
   *
   * **内部负责「记录当前位置 → 应用新样式 → 恢复到同一处」。** 改字号/行距/
   * 页边距都会让文本重排，不做这一步用户每调一次就跳页（§5.2 的坑 2）。
   * EPUB 与 TXT 两侧都要踩同一个坑，关在各自实现里这段逻辑只写一次。
   */
  applySettings(settings: ReaderSettings): void
  /** 位置索引是否已就绪，决定进度是否带 ~ 前缀 */
  locationsReady(): boolean
  destroy(): void
}

export interface EngineOptions {
  container: HTMLElement
  /**
   * 位置索引的读写，**仅 EPUB 需要** —— epub.js 要花几秒对全书分词才能算出
   * 位置索引，结果值得缓存。TXT 的进度直接由字符偏移算出，用不上它。
   *
   * 注入进来而不是让引擎直接用 window.api：这样引擎与 IPC 解耦，换数据
   * 来源时不必改它。
   */
  loadLocations?(): Promise<string | null>
  saveLocations?(json: string): Promise<void>
  callbacks: ReaderEngineCallbacks
}

import type { MarkReaderApi } from '@shared/types'

declare global {
  interface Window {
    api: MarkReaderApi
  }
}

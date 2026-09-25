import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/types'
import type { Book, CommitPayload, ImportResult, MarkReaderApi, ReaderSettings, ReadingProgress } from '@shared/types'

const api: MarkReaderApi = {
  listBooks: () => ipcRenderer.invoke(IPC.booksList) as Promise<Book[]>,
  importBook: () => ipcRenderer.invoke(IPC.booksImport) as Promise<ImportResult | null>,
  commitImport: (id: string, payload: CommitPayload) =>
    ipcRenderer.invoke(IPC.booksCommit, id, payload) as Promise<Book>,
  abortImport: (id: string) => ipcRenderer.invoke(IPC.booksAbort, id) as Promise<void>,
  deleteBook: (id: string) => ipcRenderer.invoke(IPC.booksDelete, id) as Promise<void>,
  getLocations: (id: string) => ipcRenderer.invoke(IPC.locationsGet, id) as Promise<string | null>,
  saveLocations: (id: string, json: string) =>
    ipcRenderer.invoke(IPC.locationsSave, id, json) as Promise<void>,
  saveProgress: (id: string, progress: ReadingProgress) =>
    ipcRenderer.invoke(IPC.progressSave, id, progress) as Promise<void>,
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<ReaderSettings>,
  saveSettings: (settings: ReaderSettings) =>
    ipcRenderer.invoke(IPC.settingsSave, settings) as Promise<void>,
}

contextBridge.exposeInMainWorld('api', api)

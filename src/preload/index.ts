import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getDatabases: () => ipcRenderer.invoke('get-databases'),
  getCollections: (dbName: string) => ipcRenderer.invoke('get-collections', dbName),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectRestoreTarget: () => ipcRenderer.invoke('select-restore-target'),
  // runBackup에서 useArchive 파라미터 삭제
  runBackup: (dbName: string, collectionName: string, savePath: string) =>
    ipcRenderer.invoke('run-backup', dbName, collectionName, savePath),
  runRestore: (targetDbName: string, sourcePath: string) =>
    ipcRenderer.invoke('run-restore', targetDbName, sourcePath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}

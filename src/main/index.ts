import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { MongoClient } from 'mongodb'
import { spawn } from 'child_process'
import fs from 'fs'

const MONGO_URI = 'mongodb://127.0.0.1:27017'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // DB 목록 가져오기
  ipcMain.handle('get-databases', async () => {
    const client = new MongoClient(MONGO_URI)
    try {
      await client.connect()
      const adminDb = client.db('admin')
      const result = await adminDb.command({ listDatabases: 1 })
      return result.databases.map((db: { name: string }) => db.name)
    } catch (error) {
      console.error('DB 연결 실패:', error)
      return []
    } finally {
      await client.close()
    }
  })

  // 컬렉션 목록 가져오기
  ipcMain.handle('get-collections', async (_, dbName: string) => {
    const client = new MongoClient(MONGO_URI)
    try {
      await client.connect()
      const db = client.db(dbName)
      const collections = await db.listCollections().toArray()
      return collections.map((col) => col.name).sort()
    } catch (error) {
      console.error('컬렉션 가져오기 실패:', error)
      return []
    } finally {
      await client.close()
    }
  })

  // 폴더 선택 (백업용)
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '백업 파일을 저장할 폴더를 선택하세요'
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // 복원 대상 선택 (파일 또는 폴더)
  ipcMain.handle('select-restore-target', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
      title: '복원할 백업 파일(.gz)이나 폴더를 선택하세요',
      filters: [{ name: 'Archives & Folders', extensions: ['gz', '*'] }]
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // 백업 실행
  ipcMain.handle(
    'run-backup',
    async (_, dbName: string, collectionName: string, savePath: string, useArchive: boolean) => {
      if (!savePath) return { success: false, message: '저장 경로가 지정되지 않았습니다.' }

      const timestamp = Date.now()
      const args = [`--uri=${MONGO_URI}`, `--db=${dbName}`, `--collection=${collectionName}`]
      let targetPath = ''

      if (useArchive) {
        targetPath = join(savePath, `${collectionName}_backup_${timestamp}.gz`)
        args.push('--gzip', `--archive=${targetPath}`)
      } else {
        targetPath = join(savePath, `${collectionName}_backup_${timestamp}`)
        args.push(`--out=${targetPath}`)
      }

      return new Promise((resolve) => {
        const dumpProcess = spawn('mongodump', args)

        dumpProcess.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, message: `✅ 백업 성공!\n저장 경로: ${targetPath}` })
          } else {
            resolve({
              success: false,
              message: `❌ 백업 실패 (Exit code: ${code}).`
            })
          }
        })
      })
    }
  )

  // 복원 실행
  ipcMain.handle('run-restore', async (_, targetDbName: string, sourcePath: string) => {
    if (!sourcePath) return { success: false, message: '복원할 파일/폴더 경로가 없습니다.' }

    const args = [`--uri=${MONGO_URI}`]
    if (targetDbName && targetDbName !== 'NEW_DB_OPTION') {
      args.push(`--db=${targetDbName}`)
    }

    try {
      const stat = fs.statSync(sourcePath)
      if (stat.isFile() && sourcePath.endsWith('.gz')) {
        args.push('--gzip', `--archive=${sourcePath}`)
      } else if (stat.isDirectory()) {
        args.push('--dir', sourcePath)
      } else {
        return { success: false, message: '지원하지 않는 파일 형식입니다.' }
      }
    } catch (err) {
      return { success: false, message: `경로를 읽을 수 없습니다: ${err}` }
    }

    return new Promise((resolve) => {
      const restoreProcess = spawn('mongorestore', args)

      restoreProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: `✅ 복원 성공!\n소스 경로: ${sourcePath}` })
        } else {
          resolve({
            success: false,
            message: `❌ 복원 실패 (Exit code: ${code}).`
          })
        }
      })
    })
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

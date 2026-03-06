import { useState, useEffect, JSX } from 'react'

declare global {
  interface Window {
    api: {
      getDatabases: () => Promise<string[]>
      getCollections: (dbName: string) => Promise<string[]>
      selectFolder: () => Promise<string | null>
      selectRestoreTarget: () => Promise<string | null>
      runBackup: (
        dbName: string,
        collectionName: string,
        savePath: string,
        customText: string
      ) => Promise<{ success: boolean; message: string }>
      runRestore: (
        targetDbName: string,
        sourcePath: string
      ) => Promise<{ success: boolean; message: string }>
    }
  }
}

export default function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup')
  const [databases, setDatabases] = useState<string[]>([])

  // --- Backup 탭 상태 ---
  const [backupCollections, setBackupCollections] = useState<string[]>([])
  const [backupSelectedDb, setBackupSelectedDb] = useState('')
  const [backupSelectedCol, setBackupSelectedCol] = useState('')
  const [backupSavePath, setBackupSavePath] = useState('')
  const [backupCustomText, setBackupCustomText] = useState('')
  const [backupLog, setBackupLog] = useState('백업 준비 완료...')

  // --- Restore 탭 상태 ---
  const [restoreSelectedDb, setRestoreSelectedDb] = useState('')
  const [restoreFilePath, setRestoreFilePath] = useState('')
  const [restoreLog, setRestoreLog] = useState('복원 준비 완료...')

  // 1. 초기 DB 목록 불러오기 & 초기 경로 세팅
  useEffect(() => {
    if (window.api && window.api.getDatabases) {
      window.api.getDatabases().then((dbs: string[]) => {
        setDatabases(dbs)

        let initialDb = ''
        if (dbs.includes('stock_features')) {
          initialDb = 'stock_features'
        } else if (dbs.length > 0) {
          initialDb = dbs[0]
        }

        // 초기 DB가 결정되면 한 번에 묶어서 세팅 (useEffect 연쇄 호출 방지)
        if (initialDb) {
          setBackupSelectedDb(initialDb)
          setRestoreSelectedDb(initialDb)
          setBackupSavePath(`/Volumes/cloud/Backups/mongo/${initialDb}`)
        }
      })
    }
  }, [])

  // 2. 선택된 DB가 바뀔 때 컬렉션 목록 업데이트
  useEffect(() => {
    if (!backupSelectedDb || !window.api || !window.api.getCollections) return
    window.api.getCollections(backupSelectedDb).then((cols: string[]) => {
      setBackupCollections(cols)
      if (cols.length > 0) setBackupSelectedCol(cols[0])
    })
  }, [backupSelectedDb])

  // 기존에 있던 3번 useEffect(경로 자동 업데이트)는 삭제되었습니다. (ESLint 에러 원인)

  const handleBackupSelectFolder = async (): Promise<void> => {
    if (!window.api) return
    const folderPath = await window.api.selectFolder()
    if (folderPath) {
      setBackupSavePath(folderPath)
      setBackupLog(`저장 위치가 수동으로 설정되었습니다:\n${folderPath}`)
    }
  }

  const handleBackup = async (): Promise<void> => {
    if (!window.api) return
    if (!backupSavePath) {
      setBackupLog('❌ 먼저 백업 파일이 저장될 위치(폴더)를 선택해 주세요!')
      return
    }

    setBackupLog(
      `[${backupSelectedDb}.${backupSelectedCol}] 백업을 시도합니다...\n- 형태: 단일 아카이브 파일(.archive)`
    )

    const response = await window.api.runBackup(
      backupSelectedDb,
      backupSelectedCol,
      backupSavePath,
      backupCustomText
    )
    setBackupLog((prev) => `${prev}\n${response.message}`)
  }

  const handleRestoreSelectFile = async (): Promise<void> => {
    if (!window.api) return
    const targetPath = await window.api.selectRestoreTarget()
    if (targetPath) {
      setRestoreFilePath(targetPath)
      setRestoreLog(`복원 대상이 설정되었습니다:\n${targetPath}`)
    }
  }

  const handleRestore = async (): Promise<void> => {
    if (!window.api) return
    if (!restoreFilePath) {
      setRestoreLog('❌ 먼저 복원할 파일(.archive 등)을 선택해 주세요!')
      return
    }

    const targetStr = restoreSelectedDb === 'NEW_DB_OPTION' ? '원래 DB' : restoreSelectedDb
    setRestoreLog(`[${targetStr}] 복원을 시도합니다...`)

    const response = await window.api.runRestore(restoreSelectedDb, restoreFilePath)
    setRestoreLog((prev) => `${prev}\n${response.message}`)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
      <div className="max-w-xl mx-auto bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="flex bg-slate-950 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'backup'
                ? 'text-emerald-400 bg-slate-800 border-t-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
            }`}
          >
            백업 (Backup)
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'restore'
                ? 'text-blue-400 bg-slate-800 border-t-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
            }`}
          >
            복원 (Restore)
          </button>
        </div>

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-100">
            {activeTab === 'backup' ? 'Kumah DB Backup' : 'Kumah DB Restore'}
          </h1>

          {activeTab === 'backup' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2 text-slate-400">
                    Database
                  </label>
                  <select
                    value={backupSelectedDb}
                    // 🔥 onChange 이벤트 안에서 경로까지 한 번에 바꿔줍니다!
                    onChange={(e) => {
                      const newDb = e.target.value
                      setBackupSelectedDb(newDb)
                      if (newDb) {
                        setBackupSavePath(`/Volumes/cloud/Backups/mongo/${newDb}`)
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Database</option>
                    {databases.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2 text-slate-400">
                    Collection
                  </label>
                  <select
                    value={backupSelectedCol}
                    onChange={(e) => setBackupSelectedCol(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Collection</option>
                    {backupCollections.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-400">저장 위치</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={backupSavePath}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 outline-none"
                  />
                  <button
                    onClick={handleBackupSelectFolder}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors whitespace-nowrap"
                  >
                    경로 찾기
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-400">
                  파일 이름 뒤에 추가할 텍스트 (선택)
                </label>
                <input
                  type="text"
                  value={backupCustomText}
                  onChange={(e) => setBackupCustomText(e.target.value)}
                  placeholder="예: before_update (안 쓰면 빈칸으로 저장됨)"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                onClick={handleBackup}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                백업 시작
              </button>

              <div className="mt-6">
                <label className="block text-sm font-semibold mb-2 text-slate-400">Log</label>
                <textarea
                  readOnly
                  value={backupLog}
                  className="w-full h-32 bg-black border border-slate-700 rounded-lg p-3 font-mono text-xs text-emerald-400/80 resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'restore' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-400">
                  대상 Database (어디에 복원할까요?)
                </label>
                <select
                  value={restoreSelectedDb}
                  onChange={(e) => setRestoreSelectedDb(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="NEW_DB_OPTION">원래 백업된 위치로 복원</option>
                  <optgroup label="기존 데이터베이스 덮어쓰기">
                    {databases.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-400">
                  복원할 파일 선택
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="선택된 백업 파일이 없습니다."
                    value={restoreFilePath}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 outline-none"
                  />
                  <button
                    onClick={handleRestoreSelectFile}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors whitespace-nowrap"
                  >
                    파일 찾기
                  </button>
                </div>
              </div>

              <button
                onClick={handleRestore}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                복원 시작
              </button>

              <div className="mt-6">
                <label className="block text-sm font-semibold mb-2 text-slate-400">Log</label>
                <textarea
                  readOnly
                  value={restoreLog}
                  className="w-full h-32 bg-black border border-slate-700 rounded-lg p-3 font-mono text-xs text-blue-400/80 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
      deleteCollections: (
        dbName: string,
        collectionNames: string[]
      ) => Promise<{ success: boolean; message: string }>
    }
  }
}

type TabType = 'backup' | 'restore' | 'delete'

export default function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('backup')
  const [databases, setDatabases] = useState<string[]>([])

  // 새로고침 애니메이션 상태
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  // --- Delete 탭 상태 ---
  const [deleteSelectedDb, setDeleteSelectedDb] = useState('')
  const [deleteCollections, setDeleteCollections] = useState<string[]>([])
  const [deleteSelectedCols, setDeleteSelectedCols] = useState<string[]>([])
  const [deleteLog, setDeleteLog] = useState('삭제할 컬렉션을 선택해 주세요.')

  // 1. 초기 DB 목록 불러오기 & 초기 세팅
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

        if (initialDb) {
          setBackupSelectedDb(initialDb)
          setRestoreSelectedDb(initialDb)
          setDeleteSelectedDb(initialDb)
          setBackupSavePath(`/Volumes/cloud/Backups/mongo/${initialDb}`)
        }
      })
    }
  }, [])

  // 2. 백업 탭: 선택된 DB가 바뀔 때 컬렉션 업데이트
  useEffect(() => {
    if (!backupSelectedDb || !window.api || !window.api.getCollections) return
    window.api.getCollections(backupSelectedDb).then((cols: string[]) => {
      setBackupCollections(cols)
      if (cols.length > 0) setBackupSelectedCol(cols[0])
    })
  }, [backupSelectedDb])

  // 3. 삭제 탭: 선택된 DB가 바뀔 때 컬렉션 업데이트
  useEffect(() => {
    if (!deleteSelectedDb || !window.api || !window.api.getCollections) return
    window.api.getCollections(deleteSelectedDb).then((cols: string[]) => {
      setDeleteCollections(cols)
    })
  }, [deleteSelectedDb])

  // 🔥 새로고침 핸들러
  const handleRefresh = async (): Promise<void> => {
    if (!window.api) return
    setIsRefreshing(true)

    try {
      // 1. DB 목록 갱신
      const dbs = await window.api.getDatabases()
      setDatabases(dbs)

      // 2. 현재 활성화된 탭과 선택된 DB에 맞춰 컬렉션 즉시 갱신
      if (activeTab === 'backup' && backupSelectedDb) {
        const cols = await window.api.getCollections(backupSelectedDb)
        setBackupCollections(cols)
        // 기존에 선택된 컬렉션이 삭제되어 없어졌다면 첫 번째 항목으로 변경
        if (!cols.includes(backupSelectedCol)) {
          setBackupSelectedCol(cols.length > 0 ? cols[0] : '')
        }
      } else if (activeTab === 'delete' && deleteSelectedDb) {
        const cols = await window.api.getCollections(deleteSelectedDb)
        setDeleteCollections(cols)
        // 방금 외부에서 삭제된 컬렉션이 체크박스에 있었다면 해제
        setDeleteSelectedCols((prev) => prev.filter((c) => cols.includes(c)))
      }
    } catch (error) {
      console.error('새로고침 실패:', error)
    } finally {
      // 시각적으로 도는 효과를 확실히 보여주기 위해 0.5초 유지
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // --- 백업 핸들러 ---
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

  // --- 복원 핸들러 ---
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

  // --- 삭제 핸들러 ---
  const handleCheckboxChange = (colName: string): void => {
    setDeleteSelectedCols((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    )
  }

  const handleDelete = async (): Promise<void> => {
    if (!window.api) return
    if (deleteSelectedCols.length === 0) {
      setDeleteLog('❌ 삭제할 컬렉션을 하나 이상 선택해 주세요!')
      return
    }

    const isConfirmed = window.confirm(
      `정말 [${deleteSelectedDb}] 데이터베이스에서\n${deleteSelectedCols.length}개의 컬렉션을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!`
    )

    if (!isConfirmed) {
      setDeleteLog('삭제 작업이 취소되었습니다.')
      return
    }

    setDeleteLog(`${deleteSelectedCols.length}개의 컬렉션을 삭제 중입니다...`)
    const response = await window.api.deleteCollections(deleteSelectedDb, deleteSelectedCols)
    setDeleteLog((prev) => `${prev}\n${response.message}`)

    if (response.success) {
      window.api.getCollections(deleteSelectedDb).then((cols: string[]) => {
        setDeleteCollections(cols)
        setDeleteSelectedCols([])
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
      <div className="max-w-xl mx-auto bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
        {/* 상단 탭 버튼들 */}
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
          <button
            onClick={() => setActiveTab('delete')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'delete'
                ? 'text-rose-400 bg-slate-800 border-t-2 border-rose-500'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
            }`}
          >
            삭제 (Delete)
          </button>
        </div>

        <div className="p-6">
          {/* 🔥 타이틀과 새로고침 버튼 영역 */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-100">
              {activeTab === 'backup' && 'Kumah DB Backup'}
              {activeTab === 'restore' && 'Kumah DB Restore'}
              {activeTab === 'delete' && 'Kumah DB Cleanup'}
            </h1>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold border border-slate-600"
              title="DB 및 컬렉션 목록 새로고침"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              새로고침
            </button>
          </div>

          {/* ================= 백업 탭 ================= */}
          {activeTab === 'backup' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2 text-slate-400">
                    Database
                  </label>
                  <select
                    value={backupSelectedDb}
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

          {/* ================= 복원 탭 ================= */}
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

          {/* ================= 삭제 탭 ================= */}
          {activeTab === 'delete' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-400">
                  대상 Database
                </label>
                <select
                  value={deleteSelectedDb}
                  onChange={(e) => {
                    setDeleteSelectedDb(e.target.value)
                    setDeleteCollections([])
                    setDeleteSelectedCols([])
                  }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 outline-none focus:border-rose-500 transition-colors"
                >
                  <option value="">Database를 선택하세요</option>
                  {databases.map((db) => (
                    <option key={db} value={db}>
                      {db}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-semibold text-slate-400">
                    삭제할 컬렉션 선택 (다중 선택 가능)
                  </label>
                  <span className="text-xs font-bold text-rose-400">
                    선택됨: {deleteSelectedCols.length}개
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-600 rounded-lg max-h-48 overflow-y-auto p-2">
                  {deleteCollections.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      선택된 DB에 컬렉션이 없거나 불러오는 중입니다.
                    </p>
                  ) : (
                    deleteCollections.map((col) => (
                      <label
                        key={col}
                        className="flex items-center px-3 py-2 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={deleteSelectedCols.includes(col)}
                          onChange={() => handleCheckboxChange(col)}
                          className="w-4 h-4 text-rose-500 bg-slate-900 border-slate-500 rounded focus:ring-rose-500 focus:ring-2"
                        />
                        <span className="ml-3 text-sm text-slate-300 select-none">{col}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleDelete}
                disabled={deleteSelectedCols.length === 0}
                className={`w-full mt-4 font-bold py-3 px-4 rounded-lg transition-colors ${
                  deleteSelectedCols.length > 0
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                선택한 컬렉션 영구 삭제
              </button>

              <div className="mt-6">
                <label className="block text-sm font-semibold mb-2 text-slate-400">Log</label>
                <textarea
                  readOnly
                  value={deleteLog}
                  className="w-full h-32 bg-black border border-slate-700 rounded-lg p-3 font-mono text-xs text-rose-400/80 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

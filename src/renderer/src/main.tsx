import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// 이것을 먼저 실행 npm run build
// 앱 빌드 명령어 npx electron-builder --mac --arm64
// 앱 빌드 전 이전에 만들어 놓은 dis 폴더 삭제
//
//
// rm -rf out dist build
// npm run build
// npx electron-builder --mac --arm64

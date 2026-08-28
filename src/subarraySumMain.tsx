import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/700.css'
import '@fontsource/zcool-qingke-huangyou'
import './styles.css'
import './challenges/subarray-sum-k/archive.css'
import ArchiveApp from './challenges/subarray-sum-k/ArchiveApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArchiveApp onExit={() => { window.location.href = '/' }} />
  </StrictMode>,
)

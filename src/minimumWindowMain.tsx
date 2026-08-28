import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
import '@fontsource/zcool-qingke-huangyou'
import MinimumWindowApp from './challenges/minimum-window-substring/MinimumWindowApp'
import './styles.css'
import './challenges/minimum-window-substring/minimumWindow.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MinimumWindowApp onExit={() => window.location.assign('/')} />
  </StrictMode>,
)

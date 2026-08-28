import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
import '@fontsource/zcool-qingke-huangyou'
import './styles.css'
import CharacterCorridorApp from './challenges/longest-substring-without-repeating-characters/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CharacterCorridorApp onExit={() => window.location.assign('/')} />
  </StrictMode>,
)

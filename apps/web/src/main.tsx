import '@fontsource-variable/inter'
import './design/tokens.css'
import './design/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { iniciarPreferencias } from './design/preferencias.ts'
import { instalarDesfazer } from './desfazer.ts'

iniciarPreferencias()
// Ctrl+Z em todo campo de escrita, também nos com máscara (GGVP-84, CA9).
instalarDesfazer()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

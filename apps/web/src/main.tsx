import '@fontsource-variable/inter'
import './design/tokens.css'
import './design/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { iniciarPreferencias } from './design/preferencias.ts'

iniciarPreferencias()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

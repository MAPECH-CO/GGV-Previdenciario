import '@fontsource-variable/inter'
import './design/tokens.css'
import './design/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { configurarExemplo } from './dados/servidor.ts'
import { iniciarPreferencias } from './design/preferencias.ts'

iniciarPreferencias()
// GGVP-125: o lead e a ficha já vão ao servidor de verdade; o resto da Recepção segue no modo exemplo. Os testes de
// tela não passam por aqui e continuam no modo exemplo.
configurarExemplo({ servidor: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

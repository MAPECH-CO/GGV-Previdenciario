import { useEffect, useState } from 'react'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { Entrar } from './paginas/Entrar.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { SemPerfil } from './paginas/SemPerfil.tsx'
import { Tokens } from './paginas/Tokens.tsx'
import { TrocarSenha } from './paginas/TrocarSenha.tsx'

// Roteamento mínimo, enquanto há poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
// Só "Entrar" e o guia de tokens (sem dado) abrem sem sessão; o resto confere a sessão no servidor primeiro (GGVP-117).
export function App({ caminho = window.location.pathname }: { caminho?: string }) {
  if (caminho === '/entrar') return <Entrar />
  if (caminho === '/tokens') return <Tokens />
  return <ComSessao caminho={caminho} />
}

function ComSessao({ caminho }: { caminho: string }) {
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null)

  useEffect(() => {
    // Sem sessão, chamarApi já leva ao login com a volta para esta tela.
    void chamarApi<UsuarioDaSessao>('/sessao').then((r) => r.ok && setUsuario(r.dados))
  }, [])

  if (!usuario) return null
  if (usuario.trocarSenha) return <TrocarSenha />
  if (!usuario.perfil) return <SemPerfil nome={usuario.nome} />
  if (caminho === '/') return <CentralAtendimento />
  return <NaoConstruida caminho={caminho} />
}

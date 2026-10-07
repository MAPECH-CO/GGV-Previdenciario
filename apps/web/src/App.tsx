import { useEffect, useState } from 'react'
import { ROTULO_PERFIL, ehPerfil, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { CentralEmConstrucao } from './paginas/CentralEmConstrucao.tsx'
import { Entrar } from './paginas/Entrar.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { SemPerfil } from './paginas/SemPerfil.tsx'
import { Tokens } from './paginas/Tokens.tsx'
import { TrocarSenha } from './paginas/TrocarSenha.tsx'
import { SessaoContexto } from './sessao.ts'

// Roteamento mínimo, enquanto há poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
// Só "Entrar" e o guia de tokens (sem dado) abrem sem sessão; o resto confere a sessão no servidor primeiro (GGVP-117).
export function App({ caminho = window.location.pathname }: { caminho?: string }) {
  if (caminho === '/entrar') return <Entrar />
  if (caminho === '/tokens') return <Tokens />
  return <ComSessao caminho={caminho} />
}

/** Perfis que trabalham na Central do Atendimento (a Documentação não tem Central própria; Pedro, 30/09). */
const NA_CENTRAL_DO_ATENDIMENTO = ['atendimento', 'atendimento_lider', 'documentacao']

function ComSessao({ caminho }: { caminho: string }) {
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null)

  useEffect(() => {
    // Sem sessão, chamarApi já leva ao login com a volta para esta tela.
    void chamarApi<UsuarioDaSessao>('/sessao').then((r) => r.ok && setUsuario(r.dados))
  }, [])

  if (!usuario) return null
  if (usuario.trocarSenha) return <TrocarSenha />
  if (!usuario.perfilAtivo) return <SemPerfil nome={usuario.nome} />
  return (
    <SessaoContexto value={usuario}>
      <Inicio caminho={caminho} perfil={usuario.perfilAtivo} />
    </SessaoContexto>
  )
}

function Inicio({ caminho, perfil }: { caminho: string; perfil: string }) {
  if (caminho !== '/') return <NaoConstruida caminho={caminho} />
  if (NA_CENTRAL_DO_ATENDIMENTO.includes(perfil)) return <CentralAtendimento />
  // As Centrais dos outros perfis entram com as histórias de cada épico (GGVP-78).
  return <CentralEmConstrucao rotulo={ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : perfil} />
}

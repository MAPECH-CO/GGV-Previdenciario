import { useEffect, useState, type ReactNode } from 'react'
import { ROTULO_PERFIL, ehPerfil, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { CentralEmConstrucao } from './paginas/CentralEmConstrucao.tsx'
import { Conferencia } from './paginas/Conferencia.tsx'
import { DecidirPericia } from './paginas/DecidirPericia.tsx'
import { Entrar } from './paginas/Entrar.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { Protocolar } from './paginas/Protocolar.tsx'
import { Vigilia } from './paginas/Vigilia.tsx'
import { Exige } from './paginas/SemPermissao.tsx'
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

/** Telas de passo (GGVP-8). Cada uma dentro de <Exige>: sem a permissão, nem monta (GGVP-96 CA11). */
const TELAS_DE_CASO: { padrao: RegExp; tela: (id: string) => ReactNode }[] = [
  { padrao: /^\/casos\/([0-9a-f-]{36})\/conferencia$/, tela: (id) => <Exige acao="caso.ver"><Conferencia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/protocolo$/, tela: (id) => <Exige acao="protocolo_inss.registrar"><Protocolar casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pericia$/, tela: (id) => <Exige acao="pericia.decidir"><DecidirPericia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/vigilia$/, tela: (id) => <Exige acao="caso.ver"><Vigilia casoId={id} /></Exige> },
]

function Inicio({ caminho, perfil }: { caminho: string; perfil: string }) {
  for (const { padrao, tela } of TELAS_DE_CASO) {
    const achou = caminho.match(padrao)
    if (achou) return tela(achou[1])
  }
  if (caminho !== '/') return <NaoConstruida caminho={caminho} />
  if (NA_CENTRAL_DO_ATENDIMENTO.includes(perfil)) return <CentralAtendimento />
  // As Centrais dos outros perfis entram com as histórias de cada épico (GGVP-78).
  return <CentralEmConstrucao rotulo={ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : perfil} />
}

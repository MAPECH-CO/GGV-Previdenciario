import { useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CamposNovoCliente } from '../componentes/CamposNovoCliente.tsx'
import { Cartao } from '../componentes/Cartao.tsx'
import { EscolhaPasta } from '../componentes/EscolhaPasta.tsx'
import { JaExiste } from '../componentes/JaExiste.tsx'
import { OQueAconteceDepois } from '../componentes/OQueAconteceDepois.tsx'
import { TopoFicha } from '../componentes/TopoFicha.tsx'
import { conferirDuplicidade, criarFicha, ligarPasta } from '../dados/servidor.ts'
import type { FichaResumo, PastaDrive } from '../dados/tipos.ts'
import { validarNovoCliente, type ValoresNovoCliente } from '../regras/formularios.ts'
import styles from './NovoCliente.module.css'

// Figma: "Atendimento · Novo cliente" (73:371). Passos D1.01 e D1.04 do Miro.

type Destino = 'entrevista' | 'apenas'
type Nome = keyof ValoresNovoCliente

const VAZIO: ValoresNovoCliente = {
  nome: '',
  cpf: '',
  idade: '',
  telefone: '',
  email: '',
  pretende: '',
  comoChegou: '',
  indicadoPor: '',
  cidadeUf: '',
  beneficioInteresse: 'nao-sei',
  observacao: '',
}

const ids = (fichas: FichaResumo[]) => fichas.map((f) => f.id).join()

export function NovoCliente({ navegar = (url: string) => window.location.assign(url) }: { navegar?: (url: string) => void }) {
  const [valores, setValores] = useState(VAZIO)
  const [erros, setErros] = useState<Partial<Record<Nome, string>>>({})
  const [comCpf, setComCpf] = useState<FichaResumo | undefined>()
  const [parecidas, setParecidas] = useState<FichaResumo[]>([])
  const [outraPessoa, setOutraPessoa] = useState(false)
  const [salvando, setSalvando] = useState<Destino | null>(null)
  const [progresso, setProgresso] = useState('')
  const [escolha, setEscolha] = useState<{ id: string; destino: Destino; pastas: PastaDrive[] } | null>(null)
  // Trava no mesmo clique, antes de o React redesenhar os botões (CA16).
  const travado = useRef(false)

  function avisarParecidas(fichas: FichaResumo[]) {
    if (ids(fichas) !== ids(parecidas)) setOutraPessoa(false)
    setParecidas(fichas)
  }

  async function sair(campo: Nome) {
    setErros((e) => ({ ...e, [campo]: validarNovoCliente(valores).erros[campo] }))
    if (campo !== 'nome' && campo !== 'telefone' && campo !== 'cpf') return
    const achadas = await conferirDuplicidade(valores)
    setComCpf(achadas.comCpf)
    avisarParecidas(achadas.parecidas)
  }

  async function ligar(id: string, destino: Destino, pasta: string) {
    setEscolha(null)
    setProgresso(pasta === 'nova' ? 'criando a pasta…' : 'ligando à pasta que já existe…')
    await ligarPasta(id, pasta)
    navegar(destino === 'entrevista' ? `/agenda/marcar/${id}` : `/clientes/${id}`)
  }

  async function salvar(destino: Destino) {
    if (travado.current) return
    const { erros: novos, dados } = validarNovoCliente(valores)
    setErros(novos)
    if (!dados) return setProgresso('Confira os campos marcados em vermelho.')
    travado.current = true
    setSalvando(destino)
    setProgresso('')
    // Só destrava quando nada foi gravado; com a ficha criada, os botões não voltam.
    let destravar = true
    try {
      const resposta = await criarFicha({ ...dados, outraPessoa })
      if (resposta.resultado === 'parecidas') {
        avisarParecidas(resposta.fichas)
        return setProgresso('Há ficha parecida: confira em «Já existe?» e marque «É outra pessoa» se for.')
      }
      destravar = false
      if (resposta.resultado === 'ja-existe') return navegar(`/clientes/${resposta.id}`)
      if (resposta.pastas.length > 1) return setEscolha({ id: resposta.id, destino, pastas: resposta.pastas })
      await ligar(resposta.id, destino, resposta.pastas[0]?.id ?? 'nova')
    } catch {
      setProgresso('Não deu para concluir. Confira os campos e tente de novo.')
    } finally {
      if (destravar) {
        travado.current = false
        setSalvando(null)
      }
    }
  }

  const rotulo = (destino: Destino, texto: string) => (salvando === destino ? 'salvando…' : texto)

  return (
    <>
      <title>Novo cliente · GGV Previdenciário</title>
      <TopoFicha
        titulo="Novo cliente"
        chips={[
          { texto: 'D1.01 · reconhecer quem chegou', tom: 'acento' },
          { texto: 'o mínimo para começar', tom: 'neutro' },
        ]}
      />
      <main className={styles.pagina}>
        <div className={styles.esquerda}>
          <Cartao titulo="Dados mínimos">
            <CamposNovoCliente
              valores={valores}
              erros={erros}
              aoMudar={(campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))}
              aoSair={sair}
            />
            {escolha ? (
              <EscolhaPasta pastas={escolha.pastas} aoEscolher={(pasta) => ligar(escolha.id, escolha.destino, pasta)} />
            ) : (
              <div className={styles.botoes}>
                <button type="button" className={styles.primario} disabled={salvando !== null} onClick={() => salvar('entrevista')}>
                  {rotulo('entrevista', 'Salvar e marcar a entrevista')}
                </button>
                <button type="button" className={styles.secundario} disabled={salvando !== null} onClick={() => salvar('apenas')}>
                  {rotulo('apenas', 'Salvar apenas')}
                </button>
              </div>
            )}
            <p role="status" className={styles.progresso}>
              {progresso}
            </p>
            <p className={styles.nota}>
              O resto da ficha (D1.05) é preenchido pela própria cliente pelo link; a IA completa com a entrevista e você
              confere.
            </p>
          </Cartao>
        </div>
        <div className={styles.direita}>
          <OQueAconteceDepois />
          <JaExiste comCpf={comCpf} parecidas={parecidas} outraPessoa={outraPessoa} aoMarcarOutraPessoa={setOutraPessoa} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}

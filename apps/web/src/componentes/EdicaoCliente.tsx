import { useRef, useState, type FormEvent, type HTMLAttributes } from 'react'
import { formatarCep, formatarCpf, formatarTelefone, isoParaData } from '../campos.ts'
import { FONTES } from '../dados/catalogos.ts'
import { camposProtegidosQueMudam, salvarFichaVerificada } from '../dados/seguranca.ts'
import type { Ficha } from '../dados/tipos.ts'
import { soNumeroEMascara, validarEdicao, type ValoresFicha } from '../regras/formularios.ts'
import { COMO_VERIFICOU, motivoParaNaoMudar, type ComoVerificou } from '../regras/seguranca.ts'
import { usePode, usePodeAbrir, useSessao } from '../sessao.ts'
import { Campo } from './Campo.tsx'
import styles from './EdicaoCliente.module.css'

type Erros = Partial<Record<keyof ValoresFicha, string>>

type Definicao = {
  campo: keyof ValoresFicha
  rotulo: string
  /** Letra não entra: CPF, data, telefone e CEP. */
  mascara?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
}

// As linhas do Figma 73:229 a 73:281, na mesma ordem.
const LINHAS: Definicao[][] = [
  [
    { campo: 'nome', rotulo: 'Nome completo *', maxLength: 120 },
    { campo: 'cpf', rotulo: 'CPF', mascara: true, inputMode: 'numeric', maxLength: 14 },
    { campo: 'nascimento', rotulo: 'Data de nascimento', mascara: true, inputMode: 'numeric', maxLength: 10 },
  ],
  [
    { campo: 'telefone', rotulo: 'Telefone / WhatsApp *', mascara: true, inputMode: 'tel', maxLength: 15 },
    { campo: 'email', rotulo: 'E-mail', inputMode: 'email', maxLength: 120 },
    { campo: 'estadoCivil', rotulo: 'Estado civil', maxLength: 40 },
  ],
  [
    { campo: 'endereco', rotulo: 'Endereço', maxLength: 200 },
    { campo: 'cidadeUf', rotulo: 'Cidade / UF', maxLength: 80 },
    { campo: 'cep', rotulo: 'CEP', mascara: true, inputMode: 'numeric', maxLength: 9 },
  ],
  [
    { campo: 'profissao', rotulo: 'Profissão / última atividade', maxLength: 200 },
    { campo: 'comoChegou', rotulo: 'Como chegou' },
    { campo: 'contatoPreferido', rotulo: 'Contato preferido', maxLength: 80 },
  ],
  [
    { campo: 'contatoApoio', rotulo: 'Contato de apoio', maxLength: 200 },
    { campo: 'observacoes', rotulo: 'Observações', maxLength: 1000 },
  ],
]

function valoresDa(f: Ficha): ValoresFicha {
  return {
    nome: f.nome,
    cpf: f.cpf ? formatarCpf(f.cpf) : '',
    nascimento: isoParaData(f.nascimento) ?? '',
    telefone: formatarTelefone(f.telefone),
    email: f.email ?? '',
    estadoCivil: f.estadoCivil ?? '',
    endereco: f.endereco ?? '',
    cidadeUf: f.cidadeUf ?? '',
    cep: f.cep ? formatarCep(f.cep) : '',
    profissao: f.profissao ?? '',
    comoChegou: f.comoChegou ?? '',
    contatoPreferido: f.contatoPreferido ?? '',
    contatoApoio: f.contatoApoio ?? '',
    observacoes: f.observacoes ?? '',
  }
}

/** Como chegou, pelo nome da fonte; a indicação leva o nome de quem indicou (como no formulário). */
function fonteDe(f: Ficha): string {
  const fonte = FONTES.find((x) => x.id === f.comoChegou)
  if (!fonte) return f.comoChegou ?? ''
  return fonte.id === 'indicacao' && f.indicadoPor ? `Indicação (${f.indicadoPor})` : fonte.nome
}

/** Os dados do cliente na leitura: rótulo e valor, na ordem do formulário. Vazio vira "Não informado". */
function DadosDoCliente({ ficha }: { ficha: Ficha }) {
  const v = valoresDa(ficha)
  const itens: [string, string, boolean?][] = [
    ['CPF', v.cpf],
    ['Data de nascimento', v.nascimento],
    ['Telefone / WhatsApp', v.telefone],
    ['E-mail', v.email],
    ['Estado civil', v.estadoCivil],
    ['Endereço', v.endereco],
    ['Bairro', ficha.bairro ?? ''],
    ['Cidade / UF', v.cidadeUf],
    ['CEP', v.cep],
    ['Profissão / última atividade', v.profissao],
    ['Como chegou', fonteDe(ficha)],
    ['Contato preferido', v.contatoPreferido],
    ['Contato de apoio', v.contatoApoio],
    ['Observações', v.observacoes, true],
  ]
  return (
    <dl className={styles.dados}>
      {itens.map(([rotulo, valor, largo]) => (
        <div key={rotulo} className={largo ? styles.dadoLargo : styles.dado}>
          <dt>{rotulo}</dt>
          <dd>{valor || <span className={styles.vazio}>Não informado</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Os dados do cliente (Figma 73:228 a 73:297). Abre em leitura; "Editar dados" troca para o formulário. Valida ao sair do campo e de novo ao salvar (CA15). */
export function EdicaoCliente({
  ficha,
  hoje,
  aoSalvar,
  aoIniciarConversa,
}: {
  ficha: Ficha
  hoje: string
  aoSalvar: (ficha: Ficha) => void
  /** "Iniciar conversa" abre a janela "Registrar conversa" (GGVP-76, CA9). */
  aoIniciarConversa: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState(() => valoresDa(ficha))
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  // Mudar telefone ou e-mail pede a verificação do cliente e o contrato novo (GGVP-111, CA1).
  const [verificacao, setVerificacao] = useState<{ como?: ComoVerificou; contratoNovo?: true }>({})
  const podeEditar = usePode('ficha.editar')
  // Sem sessão (a tela sozinha, nos testes), como foi desenhada.
  const semSessao = useSessao() === null
  const podeConversar = usePode('conversa.registrar') || semSessao
  const podeMarcar = usePodeAbrir(`/agenda/marcar/${ficha.id}`)
  const podeCadastro = usePodeAbrir(`/clientes/${ficha.id}/cadastro`)
  const mudaContato = camposProtegidosQueMudam(ficha, { telefone: valores.telefone, email: valores.email })
  // Trava no mesmo clique, antes de o React redesenhar o botão (CA16).
  const travado = useRef(false)
  const regras = { cpfObrigatorio: ficha.situacao === 'cliente', hoje }
  const fontes = FONTES.map((f) => (f.id === 'indicacao' && ficha.indicadoPor ? { ...f, nome: `Indicação (${ficha.indicadoPor})` } : f))

  function comecarEdicao() {
    // Os valores são os de agora da ficha, não os de uma edição anterior.
    setValores(valoresDa(ficha))
    setErros({})
    setVerificacao({})
    setAviso('')
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
    setErros({})
    setVerificacao({})
    setAviso('')
  }

  function mudar(d: Definicao, valor: string) {
    setValores((v) => ({ ...v, [d.campo]: d.mascara ? soNumeroEMascara(valor) : valor }))
    setAviso('')
  }

  function sair(campo: keyof ValoresFicha) {
    setErros((e) => ({ ...e, [campo]: validarEdicao(valores, regras).erros[campo] }))
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (travado.current) return
    const { erros: novos, dados } = validarEdicao(valores, regras)
    setErros(novos)
    if (!dados) return setAviso('Confira os campos marcados em vermelho.')
    const semVerificacao = mudaContato.map((c) => motivoParaNaoMudar(c, verificacao)).find(Boolean)
    if (semVerificacao) return setAviso(semVerificacao)
    travado.current = true
    setSalvando(true)
    try {
      const resposta = await salvarFichaVerificada(ficha.id, dados, mudaContato.length ? verificacao : null)
      if ('erro' in resposta) return setErros({ cpf: `Este CPF já está na ficha de ${resposta.nome}.` })
      setValores(valoresDa(resposta.ficha))
      setVerificacao({})
      aoSalvar(resposta.ficha)
      setEditando(false)
      setAviso('Alterações salvas. Ficaram no histórico.')
    } catch (falha) {
      setAviso(falha instanceof Error ? falha.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  if (!editando) {
    return (
      <div className={styles.leitura}>
        <h3 className={styles.titulo}>Dados do cliente</h3>
        <DadosDoCliente ficha={ficha} />
        <div className={styles.botoes}>
          {podeEditar && (
            <button type="button" className={styles.botao} onClick={comecarEdicao}>
              Editar dados
            </button>
          )}
          {podeConversar && (
            <button type="button" className={styles.botao} onClick={aoIniciarConversa}>
              Iniciar conversa
            </button>
          )}
          {podeMarcar && (
            <a className={styles.botao} href={`/agenda/marcar/${ficha.id}`}>
              Marcar entrevista
            </a>
          )}
        </div>
        <p role="status" className={styles.aviso}>
          {aviso}
        </p>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={salvar} noValidate aria-labelledby="editar-dados">
      <h3 id="editar-dados" className={styles.titulo}>
        Editar dados do cliente
      </h3>
      {LINHAS.map((linha) => (
        <div key={linha[0].campo} className={styles.linha}>
          {linha.map((d) => (
            <Campo
              key={d.campo}
              id={`ficha-${d.campo}`}
              rotulo={d.campo === 'cpf' && regras.cpfObrigatorio ? 'CPF *' : d.rotulo}
              valor={valores[d.campo]}
              aoMudar={(valor) => mudar(d, valor)}
              aoSair={() => sair(d.campo)}
              erro={erros[d.campo]}
              opcoes={d.campo === 'comoChegou' ? fontes : undefined}
              inputMode={d.inputMode}
              maxLength={d.maxLength}
            />
          ))}
        </div>
      ))}
      {mudaContato.length > 0 && (
        <fieldset className={styles.verificacao}>
          <legend className={styles.legenda}>Mudou o {mudaContato.map((c) => (c === 'telefone' ? 'telefone' : 'e-mail')).join(' e o ')}: como você confirmou que é o cliente?</legend>
          {(Object.keys(COMO_VERIFICOU) as ComoVerificou[]).map((como) => (
            <label key={como} className={styles.opcao}>
              <input type="radio" name="como-verificou" checked={verificacao.como === como} onChange={() => setVerificacao((v) => ({ ...v, como }))} />
              {COMO_VERIFICOU[como]}
            </label>
          ))}
          <label className={styles.opcao}>
            <input
              type="checkbox"
              checked={verificacao.contratoNovo === true}
              onChange={(e) => setVerificacao((v) => ({ ...v, contratoNovo: e.target.checked ? true : undefined }))}
            />
            A alteração vai em contrato novo
          </label>
          <p className={styles.nota}>Pedido por telefone ou mensagem, sem a verificação: não mude. Diga que vai retornar pelo contato cadastrado.</p>
        </fieldset>
      )}
      <div className={styles.botoes}>
        <button type="submit" className={styles.salvar} disabled={salvando}>
          {salvando ? 'salvando…' : 'Salvar alterações'}
        </button>
        <button type="button" className={styles.botao} onClick={cancelar}>
          Cancelar
        </button>
        {/* O Figma chama de "Registrar contato"; o cartão GGVP-76 (CA9, Pedro 07/10), de "Iniciar conversa". Vale o cartão. */}
        {podeConversar && (
          <button type="button" className={styles.botao} onClick={aoIniciarConversa}>
            Iniciar conversa
          </button>
        )}
        {/* O cartão chama de "Marcar entrevista" (GGVP-123, CA1); o Figma, de "Marcar reunião". Vale o cartão. */}
        {podeMarcar && (
          <a className={styles.botao} href={`/agenda/marcar/${ficha.id}`}>
            Marcar entrevista
          </a>
        )}
        <p role="status" className={styles.aviso}>
          {aviso}
        </p>
      </div>
      <p className={styles.nota}>Toda alteração fica no histórico (quem, quando, o que mudou).</p>
      {podeCadastro && (
        <p className={styles.nota}>
          <a href={`/clientes/${ficha.id}/cadastro`}>Abrir o cadastro completo</a>
        </p>
      )}
    </form>
  )
}

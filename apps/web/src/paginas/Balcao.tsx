import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { SETORES } from '../dados/catalogos.ts'
import { buscarNoBalcao, encaminhar } from '../dados/servidor.ts'
import type { ResultadoBusca, Setor } from '../dados/tipos.ts'
import { MINIMO_DIGITOS, MINIMO_LETRAS } from '../regras/busca.ts'
import { hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'

// Figma: step_D1.01 "Balcão · Receber quem chegou" (10:3). Passos D1.01, D1.03 e D1.04 do Miro.

type Opcao = 'documento' | 'entrevista' | 'outra-etapa' | 'nova-demanda'

const OPCOES: { id: Opcao; rotulo: string; soCliente?: boolean }[] = [
  { id: 'documento', rotulo: 'Entregar documento' },
  { id: 'entrevista', rotulo: 'Entrevista agendada' },
  { id: 'outra-etapa', rotulo: 'Outra etapa' },
  { id: 'nova-demanda', rotulo: 'Nova demanda', soCliente: true },
]

type Feito = { setor: Setor; quando: string }

function buscaValida(termo: string): boolean {
  return /\p{L}/u.test(termo)
    ? termo.replace(/\s+/g, '').length >= MINIMO_LETRAS
    : termo.replace(/\D+/g, '').length >= MINIMO_DIGITOS
}

export function Balcao({ navegar = (url: string) => window.location.assign(url) }: { navegar?: (url: string) => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null)
  const [escolhido, setEscolhido] = useState<ResultadoBusca | null>(null)
  const [opcao, setOpcao] = useState<Opcao | null>(null)
  const [setor, setSetor] = useState<Setor | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<Feito | null>(null)

  useEffect(() => {
    if (!buscaValida(termo)) {
      setResultados(null)
      return
    }
    let valendo = true
    buscarNoBalcao(termo).then((lista) => {
      if (valendo) setResultados(lista)
    })
    return () => {
      valendo = false
    }
  }, [termo])

  const ninguem = resultados !== null && resultados.length === 0
  const entrevistaHoje = escolhido?.agendamentoHoje
  const motivoParado = !escolhido
    ? 'Busque e escolha quem chegou.'
    : !opcao
      ? 'Escolha o que a pessoa veio fazer.'
      : opcao === 'outra-etapa' && !setor
        ? 'Escolha o setor responsável pela etapa.'
        : opcao === 'entrevista' && !entrevistaHoje
          ? 'Não há entrevista marcada hoje.'
          : null

  function escolher(pessoa: ResultadoBusca) {
    setEscolhido(pessoa)
    setFeito(null)
    if (opcao === 'nova-demanda' && pessoa.situacao !== 'cliente') setOpcao(null)
  }

  function recomecar() {
    setTermo('')
    setEscolhido(null)
    setOpcao(null)
    setSetor(null)
    setFeito(null)
  }

  async function aoEncaminhar() {
    if (!escolhido || !opcao || motivoParado || enviando) return
    if (opcao === 'documento') return navegar(`/balcao/documento/${escolhido.id}`)
    if (opcao === 'nova-demanda') return navegar(`/clientes/${escolhido.id}/nova-demanda`)
    const destino: Setor = opcao === 'entrevista' ? 'Jurídico' : setor!
    setEnviando(true)
    try {
      const { evento } = await encaminhar({ fichaId: escolhido.id, motivo: opcao, setor: destino })
      setFeito({ setor: destino, quando: evento.quando })
    } finally {
      setEnviando(false)
    }
  }

  const beneficio = escolhido?.casos[0]?.beneficio ?? escolhido?.beneficioInteresse

  return (
    <>
      <title>Balcão · GGV Previdenciário</title>
      <TopoPasso contexto="Balcão · agora" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.01 · Verificar o agendamento (passo do BPMN)">
                D1.01
              </span>
              <span className={styles.codigo}>Atendimento</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>Balcão</strong> · Receber quem chegou
            </h1>
            <p className={styles.subtitulo}>
              {escolhido ? `${escolhido.nome} · ${escolhido.etapa}` : 'Recepção · sem processo ainda'}
            </p>
          </div>

          <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
            <div className={styles.instrucoesTopo}>
              <span className={styles.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
                O que você deve fazer
              </h2>
              <span className={styles.beneficio}>◆ {beneficio || 'a definir'}</span>
              <span className={styles.instrucoesDe}>· Recepção</span>
            </div>
            <p className={styles.instrucoesTexto}>
              Pergunte o nome e o motivo da visita. Se veio entregar documento, encaminhe à Documentação e ao scanner
              (D1.02). Se é lead novo, crie o cliente com o mínimo (nome, CPF, telefone) e marque a entrevista. Se já é
              cliente, abra a ficha pelo nome e veja a tarefa aberta. Não dê opinião sobre benefício: quem define é a
              advogada (G3).
            </p>
            <div className={styles.atalhos}>
              {escolhido ? (
                <a className={styles.atalho} href={`/clientes/${escolhido.id}`}>
                  Abrir a ficha do cliente
                </a>
              ) : (
                <button type="button" className={styles.atalho} aria-disabled="true">
                  Abrir a ficha do cliente
                </button>
              )}
              <button type="button" className={styles.atalho} aria-disabled="true">
                ▶ Entrevista e transcrições
              </button>
              <button type="button" className={styles.atalho} aria-disabled="true">
                Parecer médico
              </button>
            </div>
            <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="quem-chegou">
            <h2 id="quem-chegou" className={styles.cartaoTitulo}>
              Quem chegou?
            </h2>
            <div className={styles.busca} role="search">
              <span className={styles.lupa} aria-hidden="true">
                ⌕
              </span>
              <input
                className={styles.buscaEntrada}
                type="search"
                aria-label="Buscar por nome, CPF ou telefone"
                placeholder="Buscar por nome, CPF ou telefone"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
            <p role="status" className={styles.contagem}>
              {resultados === null
                ? ''
                : resultados.length === 1
                  ? '1 pessoa encontrada'
                  : resultados.length > 1
                    ? `${resultados.length} pessoas encontradas`
                    : ''}
            </p>
            {resultados && resultados.length > 0 && (
              <ul className={styles.resultados} aria-label="Pessoas encontradas">
                {resultados.map((pessoa) => (
                  <li key={pessoa.id}>
                    <button
                      type="button"
                      className={styles.pessoa}
                      aria-pressed={escolhido?.id === pessoa.id}
                      onClick={() => escolher(pessoa)}
                    >
                      <span className={styles.pessoaTopo}>
                        <span className={styles.pessoaNome}>{pessoa.nome}</span>
                        <span className={pessoa.situacao === 'cliente' ? styles.seloCliente : styles.seloLead}>
                          {pessoa.situacao === 'cliente' ? 'Cliente' : 'Lead'}
                        </span>
                      </span>
                      {pessoa.situacao === 'cliente' ? (
                        pessoa.casos.map((caso) => (
                          <span key={caso.beneficio} className={styles.pessoaLinha}>
                            ◆ {caso.beneficio} · {caso.etapa}
                          </span>
                        ))
                      ) : (
                        <span className={styles.pessoaLinha}>
                          {pessoa.etapa}
                          {pessoa.beneficioInteresse ? ` · interesse: ${pessoa.beneficioInteresse}` : ''}
                        </span>
                      )}
                      <span className={pessoa.agendamentoHoje ? styles.pessoaHoje : styles.pessoaLinha}>
                        {pessoa.agendamentoHoje
                          ? `Hoje ${pessoa.agendamentoHoje.hora} · ${pessoa.agendamentoHoje.oQue}${pessoa.agendamentoHoje.com ? ` com ${pessoa.agendamentoHoje.com}` : ''}`
                          : 'Sem agendamento hoje'}
                        {pessoa.situacao === 'lead' &&
                          (pessoa.fichaAtendimentoPreenchida
                            ? ' · ficha de atendimento preenchida'
                            : ' · ficha de atendimento ainda não preenchida')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ninguem && (
              <div className={styles.ninguem}>
                <p>Ninguém com esse nome, CPF ou telefone. Se é a primeira vez, cadastre com o mínimo.</p>
                <a className={styles.novoCliente} href="/clientes/novo">
                  + Novo cliente
                </a>
              </div>
            )}
          </section>

          {feito && escolhido ? (
            <section className={styles.feito} aria-labelledby="encaminhado">
              <h2 id="encaminhado" className={styles.feitoTitulo}>
                ✓ Encaminhado {feito.setor === 'Jurídico' ? 'ao Jurídico' : `ao setor ${feito.setor}`} às {hora(feito.quando)}
              </h2>
              <p>A tarefa leva a ficha e o agendamento de {escolhido.nome}. O encaminhamento ficou no histórico da ficha.</p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/clientes/${escolhido.id}`}>
                  Abrir a ficha do cliente
                </a>
                <button type="button" className={styles.atalho} onClick={recomecar}>
                  Receber a próxima pessoa
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="veio-fazer">
                <h2 id="veio-fazer" className={styles.cartaoTitulo}>
                  O que o cliente veio fazer?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="veio-fazer">
                  {OPCOES.filter((o) => !o.soCliente || escolhido?.situacao === 'cliente').map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={opcao === o.id}
                      className={styles.opcao}
                      onClick={() => setOpcao(o.id)}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                {opcao === 'outra-etapa' && (
                  <div className={styles.setor}>
                    <p id="setor" className={styles.setorRotulo}>
                      Setor responsável pela etapa *
                    </p>
                    <div className={styles.setores} role="radiogroup" aria-labelledby="setor">
                      {SETORES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={setor === s}
                          className={styles.chip}
                          onClick={() => setSetor(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {opcao && (
                <div className={styles.aviso}>
                  {opcao === 'documento' && <p>Quem veio entregar documento vai para a Documentação e o scanner.</p>}
                  {opcao === 'entrevista' &&
                    (entrevistaHoje ? (
                      <p>
                        {entrevistaHoje.com ? `A ${entrevistaHoje.com}` : 'A advogada'} (Jurídico) recebe o aviso com a ficha
                        e o agendamento das {entrevistaHoje.hora}.
                        {escolhido?.situacao === 'lead' &&
                          !escolhido.fichaAtendimentoPreenchida &&
                          ' A ficha de atendimento ainda não foi preenchida: a cliente preenche pelo link antes de entrar.'}
                      </p>
                    ) : (
                      <p>
                        Não há entrevista marcada hoje{escolhido ? ` para ${escolhido.nome}` : ''}.{' '}
                        {escolhido && (
                          <a className={styles.avisoLink} href={`/agenda/marcar/${escolhido.id}`}>
                            Marcar a entrevista
                          </a>
                        )}
                      </p>
                    ))}
                  {opcao === 'outra-etapa' && (
                    <p>
                      {setor ? `O setor ${setor}` : 'O setor escolhido'} recebe a tarefa com a ficha e o agendamento.
                    </p>
                  )}
                  {opcao === 'nova-demanda' && (
                    <p>Abre um processo novo na mesma ficha: outro benefício é outro processo, com contrato novo.</p>
                  )}
                </div>
              )}

              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoParado !== null || enviando}
                  onClick={aoEncaminhar}
                >
                  {enviando ? 'encaminhando…' : 'Encaminhar'}
                </button>
                {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
              </div>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.01.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <Decisao
            pergunta="Já é cliente do escritório?"
            opcoes={['Sim, já é cliente', 'Não, é lead']}
            resposta={escolhido ? (escolhido.situacao === 'cliente' ? 0 : 1) : ninguem ? 1 : null}
          />
          <Decisao
            pergunta="Se «Não, é lead»: O lead já está cadastrado? (contato prévio ou data marcada)"
            opcoes={['Sim, confirmar o agendamento', 'Não, lead novo']}
            resposta={escolhido?.situacao === 'lead' ? 0 : ninguem ? 1 : null}
          />
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Buscar por nome, CPF ou telefone</li>
            <li>• Se «Outra etapa»: Setor responsável pela etapa* (Jurídico, Documentação · ADM, Financeiro)</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.trava}>
            Só o CPF já existente abre o cadastro e nunca cria um segundo; telefone ou nome igual só avisa e deixa seguir.
          </p>
          <p className={styles.ladoSub}>«Encaminhar» só habilita com as decisões respondidas e os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}

/** Uma decisão do BPMN: a resposta sai da busca e aparece acesa. */
function Decisao({ pergunta, opcoes, resposta }: { pergunta: string; opcoes: string[]; resposta: number | null }) {
  return (
    <div className={styles.decisao}>
      <p>{pergunta}</p>
      <p className={styles.ladoOpcoes}>
        {opcoes.map((texto, i) => (
          <span key={texto} className={styles.chip} data-ativa={resposta === i} aria-hidden="true">
            {texto}
          </span>
        ))}
        <span className="so-leitor">{resposta === null ? 'Sem resposta ainda.' : `Resposta: ${opcoes[resposta]}.`}</span>
      </p>
    </div>
  )
}

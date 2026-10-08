import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoPasso } from '../componentes/CabecalhoDoPasso.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { BENEFICIOS, nomeBeneficio, nomeTipo } from '../dados/catalogos.ts'
import { NOMES_DOS_TIPOS, abrirDemanda } from '../dados/novaDemanda.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { Demanda, Ficha, TipoDeDemanda } from '../dados/tipos.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  TAMANHO_DO_PEDIDO,
  demandaAberta,
  entrevistaDaDemanda,
  motivoParadoDaDemanda,
  nomeDaSubpasta,
  pessoaisNaPasta,
} from '../regras/novaDemanda.ts'
import resumo from '../componentes/CartaoFechamento.module.css'
import styles from './Balcao.module.css'
import proprio from './RegistrarFechamento.module.css'

// A nova demanda de quem já é cliente (GGVP-124). Sem tela própria no Figma: o botão "Nova demanda" está na ficha do cliente
// (73:199, 73:2) e no balcão (step_D1.01, 10:3); a tela segue o desenho das telas de passo.

const TIPOS: { id: TipoDeDemanda; rotulo: string }[] = [
  { id: 'outro-pedido', rotulo: 'Outro pedido' },
  { id: 'tentar-de-novo', rotulo: 'Tentar de novo depois de perder' },
  { id: 'recurso-ou-defesa', rotulo: 'Recurso ou defesa' },
]

const QUEM_ABRE = [
  { id: 'atendimento', nome: 'Atendimento' },
  { id: 'advogada', nome: 'Advogada' },
]

/** O próximo passo da demanda aberta: marcar a entrevista, esperar por ela ou registrar se fechou (CA2, CA3, CA9). */
function ProximoPasso({ ficha, demanda, hoje }: { ficha: Ficha; demanda: Demanda; hoje: string }) {
  const entrevista = entrevistaDaDemanda(ficha, demanda)
  if (entrevista?.estado === 'realizado') {
    return (
      <>
        <p className={proprio.texto}>Entrevista feita em {dataCurta(entrevista.data, hoje)}: registre se fechou com o escritório.</p>
        <a className={styles.atalho} href={`/clientes/${ficha.id}/fechamento`}>
          Registrar fechamento
        </a>
      </>
    )
  }
  if (entrevista && emAberto(entrevista)) {
    return (
      <p className={proprio.texto}>
        Entrevista marcada para {dataCurta(entrevista.data, hoje)} às {entrevista.hora}
        {entrevista.com ? ` com ${entrevista.com}` : ''}.
      </p>
    )
  }
  return (
    <>
      <p className={proprio.texto}>
        {entrevista?.estado === 'faltou'
          ? `Faltou à entrevista de ${dataCurta(entrevista.data, hoje)}: remarque.`
          : demanda.abertaPor === 'advogada'
            ? 'O Atendimento recebeu a tarefa "Ligar para o cliente" para marcar a entrevista.'
            : 'Marque a entrevista: segue o mesmo caminho de marcar e entrevistar.'}
      </p>
      <a
        className={styles.atalho}
        href={`/agenda/marcar/${ficha.id}${entrevista?.estado === 'faltou' ? `?remarcar=${encodeURIComponent(entrevista.id)}` : ''}`}
      >
        Marcar a entrevista
      </a>
    </>
  )
}

export function NovaDemanda({ fichaId }: { fichaId: string }) {
  const hoje = hojeIso(agora())
  // undefined: abrindo; null: não existe.
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [tipo, setTipo] = useState<TipoDeDemanda | null>(null)
  const [pretende, setPretende] = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [abertaPor, setAbertaPor] = useState<Demanda['abertaPor']>('atendimento')
  const [abrindo, setAbrindo] = useState(false)
  const [aberta, setAberta] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterFicha(fichaId).then((f) => {
      if (valendo) setFicha(f)
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  if (!ficha) {
    return (
      <main className={proprio.vazia}>
        <title>Nova demanda · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{ficha === null ? 'Ficha não encontrada' : 'Abrindo a ficha…'}</h1>
        {ficha === null && <a href="/balcao">Voltar ao balcão</a>}
      </main>
    )
  }

  const cliente = ficha.situacao === 'cliente'
  const demanda = demandaAberta(ficha)
  const motivoParado = motivoParadoDaDemanda({ tipo, pretende, beneficio }, ficha)
  const doCaso = demanda?.beneficio ?? beneficio
  const pessoais = pessoaisNaPasta(ficha).map(nomeTipo)
  const n = ficha.processos.length

  async function abrir() {
    if (travado.current || motivoParado || !tipo) return
    travado.current = true
    setAbrindo(true)
    setErro('')
    try {
      const r = await abrirDemanda(fichaId, {
        tipo,
        pretende,
        beneficio,
        abertaPor,
      })
      setFicha(r.ficha)
      setAberta(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para abrir a demanda.')
    } finally {
      travado.current = false
      setAbrindo(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Nova demanda · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${cliente ? 'Cliente' : 'Lead'} · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoPasso
            passo="D1.01"
            nomeDoPasso="O que o cliente veio fazer? · nova demanda"
            setor="Atendimento"
            tarefa="Nova demanda"
            subtitulo={`${ficha.situacao} desde ${ficha.desde} · ${n === 1 ? '1 processo' : `${n} processos`} na ficha · caso novo, sem cadastro novo`}
            ficha={ficha}
            beneficio={doCaso || undefined}
            instrucoes={
              'Registre o que a pessoa quer agora e o benefício de interesse: o caso novo nasce na mesma ficha, sem cadastro novo. Outro ' +
              'pedido, ou tentar de novo depois de perder, é processo novo, com número novo, kit novo (contrato e procuração) e subpasta ' +
              'própria; recurso e defesa seguem no mesmo processo. Depois, marque a entrevista: segue o mesmo caminho de marcar e ' +
              'entrevistar. Os documentos pessoais que já estão na pasta não são pedidos de novo.'
            }
          />

          {!cliente ? (
            <p className={styles.aviso}>
              Nova demanda é para quem já é cliente: {ficha.nome.split(' ')[0]} ainda é lead.{' '}
              <a className={styles.avisoLink} href="/balcao">
                Voltar ao balcão
              </a>
            </p>
          ) : (
            <>
              {demanda ? (
                <section className={aberta ? styles.feito : styles.cartao} aria-labelledby="aberta">
                  <h2 id="aberta" className={aberta ? styles.feitoTitulo : styles.cartaoTitulo}>
                    ✓ Nova demanda aberta na mesma ficha
                  </h2>
                  <dl className={resumo.linhas}>
                    <div>
                      <dt>O que quer</dt>
                      <dd>{demanda.pretende}</dd>
                    </div>
                    <div>
                      <dt>Benefício</dt>
                      <dd>{nomeBeneficio(demanda.beneficio)}</dd>
                    </div>
                    <div>
                      <dt>Tipo</dt>
                      <dd>{NOMES_DOS_TIPOS[demanda.tipo]}</dd>
                    </div>
                    <div>
                      <dt>Aberta</dt>
                      <dd>{`${demanda.quem} · ${dataCurta(demanda.data, hoje)}`}</dd>
                    </div>
                  </dl>
                  <ProximoPasso ficha={ficha} demanda={demanda} hoje={hoje} />
                </section>
              ) : (
                <section className={styles.cartao} aria-labelledby="preencher">
                  <h2 id="preencher" className={styles.cartaoTitulo}>
                    Preencher
                  </h2>
                  <div className={proprio.campos}>
                    <Campo
                      id="pretende"
                      rotulo="O que a pessoa quer *"
                      valor={pretende}
                      aoMudar={setPretende}
                      maxLength={TAMANHO_DO_PEDIDO}
                      placeholder="ex.: auxílio-acidente pelo braço; consignado; seguro"
                      largo
                    />
                    <Campo id="beneficio" rotulo="Benefício de interesse *" valor={beneficio} opcoes={BENEFICIOS} aoMudar={setBeneficio} />
                    <Campo
                      id="aberta-por"
                      rotulo="Quem abre a demanda *"
                      valor={abertaPor}
                      opcoes={QUEM_ABRE}
                      aoMudar={(v) => setAbertaPor(v === 'advogada' ? 'advogada' : 'atendimento')}
                      dica="Aberta pela advogada, o Atendimento recebe a tarefa de ligar para o cliente."
                    />
                  </div>
                  {tipo === 'recurso-ou-defesa' && (
                    <p className={styles.aviso}>
                      Recurso e defesa seguem no mesmo processo: não abre processo novo. Encaminhe ao Jurídico pelo balcão.{' '}
                      <a className={styles.avisoLink} href="/balcao">
                        Ir ao balcão
                      </a>
                    </p>
                  )}
                </section>
              )}

              <section className={styles.cartao} aria-labelledby="na-ficha">
                <h2 id="na-ficha" className={styles.cartaoTitulo}>
                  O que já está na ficha
                </h2>
                <dl className={resumo.linhas}>
                  <div>
                    <dt>Processos</dt>
                    <dd>
                      {n === 0
                        ? 'Nenhum processo ainda.'
                        : ficha.processos.map((p) => `${nomeBeneficio(p.beneficio)} · ${p.etapa}`).join('; ')}
                    </dd>
                  </div>
                  <div>
                    <dt>Documentos pessoais</dt>
                    <dd>
                      {pessoais.length ? `${pessoais.join(', ')}: já estão na pasta, não se pedem de novo.` : 'Nenhum na pasta ainda.'}
                    </dd>
                  </div>
                  <div>
                    <dt>Processo novo</dt>
                    <dd>
                      Número novo, kit novo (contrato e procuração) e a subpasta{' '}
                      {doCaso && doCaso !== 'nao-sei'
                        ? `«${nomeDaSubpasta(doCaso, hoje)}»`
                        : 'com o benefício e o ano, quando a advogada definir o benefício'}{' '}
                      na pasta do cliente.
                    </dd>
                  </div>
                </dl>
              </section>

              {demanda ? (
                <div className={styles.atalhos}>
                  <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                    Abrir a ficha do cliente
                  </a>
                  <a className={styles.atalho} href="/">
                    Voltar ao início
                  </a>
                </div>
              ) : (
                <>
                  <p className={styles.trava}>
                    Processo novo é só para outro pedido ou para tentar de novo depois de perder; recurso e defesa seguem no mesmo processo.
                  </p>
                  <div className={styles.rodape}>
                    <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || abrindo} onClick={abrir}>
                      {abrindo ? 'abrindo…' : 'Abrir a nova demanda'}
                    </button>
                    {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
                    {erro && (
                      <p role="alert" className={styles.motivo}>
                        {erro}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>
            A terceira saída de «O que o cliente veio fazer?» (D1); o passo ainda não está desenhado no Miro.
          </p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="tipo-pergunta">O que a pessoa veio fazer?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="tipo-pergunta">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  className={styles.chip}
                  aria-checked={tipo === t.id}
                  disabled={!cliente || demanda !== undefined}
                  onClick={() => setTipo(t.id)}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• O que a pessoa quer* (da mesma natureza ou de outra, como consignado ou seguro)</li>
            <li>• Benefício de interesse*</li>
            <li>• Quem abre a demanda*: Atendimento ou advogada</li>
          </ul>
          <h3 className={styles.ladoSecao}>Na entrevista</h3>
          <p className={styles.ladoSub}>
            A IA preenche só o que é do processo novo. Dado pessoal que mudou vem como sugestão para alguém conferir, e o valor antigo fica
            no histórico.
          </p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Abrir a nova demanda» só habilita com a decisão respondida e os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}

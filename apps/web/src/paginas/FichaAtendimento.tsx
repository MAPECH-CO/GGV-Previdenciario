import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { CampoCofre } from '../componentes/CampoCofre.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarCpf, formatarTelefone, isoParaData, normalizarData, dataParaIso } from '../campos.ts'
import { BENEFICIOS, nomeBeneficio, type ItemCatalogo } from '../dados/catalogos.ts'
import { conferirTelefone, dataDaFicha, lerFichaEmPapel, salvarFichaDeAtendimento } from '../dados/fichaAtendimento.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { EnvioDaFicha, Ficha, LeituraDaFicha, SenhaGov } from '../dados/tipos.ts'
import { hojeIso, hora, idadeEm } from '../regras/datas.ts'
import {
  LIMITES,
  OBRIGATORIOS,
  ROTULOS_DA_FICHA,
  errosDaFicha,
  oQueFalta,
  paraEnvio,
  type CampoDaFicha,
  type ValoresDaFicha,
} from '../regras/fichaAtendimento.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import styles from './Balcao.module.css'
import proprio from './FichaAtendimento.module.css'

// Figma: step_D1.05 "Preencher ficha" (10:54). Hoje a ficha é em papel e o Atendimento confere a leitura da IA (CA14);
// com ?modo=tablet, a mesma ficha uma pergunta por vez, para o cliente (CA1, quando o tablet chegar).

type Pergunta = {
  campo: CampoDaFicha
  /** Como o tablet pergunta, em linguagem simples (CA1). */
  pergunta: string
  placeholder?: string
  /** Letra não entra: CPF, data, telefone e número. */
  mascara?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  opcoes?: ItemCatalogo[]
}

const PERGUNTAS: Pergunta[] = [
  { campo: 'nome', pergunta: 'Qual é o seu nome completo?', placeholder: 'Nome do cliente', maxLength: 120 },
  { campo: 'cpf', pergunta: 'Qual é o seu CPF?', placeholder: '000.000.000-00', mascara: true, inputMode: 'numeric', maxLength: 14 },
  { campo: 'nascimento', pergunta: 'Qual é a sua data de nascimento?', placeholder: 'dd/mm/aaaa', mascara: true, inputMode: 'numeric', maxLength: 10 },
  { campo: 'telefone', pergunta: 'Qual é o seu telefone ou WhatsApp, com DDD?', placeholder: '(11) 90000-0000', mascara: true, inputMode: 'tel', maxLength: 15 },
  { campo: 'endereco', pergunta: 'Qual é o seu endereço?', placeholder: 'rua, número e bairro', maxLength: LIMITES.endereco },
  { campo: 'pessoasNaCasa', pergunta: 'Quantas pessoas moram na sua casa, contando você?', placeholder: 'ex.: 3', mascara: true, inputMode: 'numeric', maxLength: 2 },
  { campo: 'beneficioInteresse', pergunta: 'Qual benefício você procura?', opcoes: BENEFICIOS },
  { campo: 'ultimaAtividade', pergunta: 'Qual foi o seu último trabalho?', placeholder: 'ex.: auxiliar de limpeza, com carteira, até 05/2026', maxLength: LIMITES.ultimaAtividade },
  { campo: 'semTrabalharDesde', pergunta: 'Desde quando você está sem trabalhar?', placeholder: 'ex.: 06/2026', maxLength: LIMITES.semTrabalharDesde },
  { campo: 'pedidosAoInss', pergunta: 'O que você já pediu ao INSS?', placeholder: 'ex.: auxílio negado em 08/2026', maxLength: LIMITES.pedidosAoInss },
]

const rotulo = (c: CampoDaFicha) => `${ROTULOS_DA_FICHA[c]}${OBRIGATORIOS.includes(c) ? ' *' : ''}`

function valoresDa(f: Ficha): ValoresDaFicha {
  return {
    nome: f.nome,
    cpf: f.cpf ? formatarCpf(f.cpf) : '',
    nascimento: isoParaData(f.nascimento) ?? '',
    telefone: f.telefone ? formatarTelefone(f.telefone) : '',
    endereco: f.endereco ?? '',
    pessoasNaCasa: f.fichaAtendimento?.pessoasNaCasa?.toString() ?? '',
    beneficioInteresse: f.beneficioInteresse ?? 'nao-sei',
    ultimaAtividade: f.fichaAtendimento?.ultimaAtividade ?? '',
    semTrabalharDesde: f.fichaAtendimento?.semTrabalharDesde ?? '',
    pedidosAoInss: f.fichaAtendimento?.pedidosAoInss ?? '',
  }
}

/** Os campos lidos pela IA, já no formato da tela. */
function daLeitura(c: Partial<EnvioDaFicha>): Partial<ValoresDaFicha> {
  const v: Partial<ValoresDaFicha> = {}
  if (c.nome) v.nome = c.nome
  if (c.cpf) v.cpf = formatarCpf(c.cpf)
  if (c.nascimento) v.nascimento = c.nascimento
  if (c.telefone) v.telefone = formatarTelefone(c.telefone)
  if (c.endereco) v.endereco = c.endereco
  if (c.pessoasNaCasa !== undefined) v.pessoasNaCasa = String(c.pessoasNaCasa)
  if (c.beneficioInteresse) v.beneficioInteresse = c.beneficioInteresse
  if (c.ultimaAtividade) v.ultimaAtividade = c.ultimaAtividade
  if (c.semTrabalharDesde) v.semTrabalharDesde = c.semTrabalharDesde
  if (c.pedidosAoInss) v.pedidosAoInss = c.pedidosAoInss
  return v
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

export function FichaAtendimento({ fichaId, tablet = false }: { fichaId: string; tablet?: boolean }) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [valores, setValores] = useState<ValoresDaFicha | null>(null)
  const [tocados, setTocados] = useState<Set<CampoDaFicha>>(new Set())
  const [lidos, setLidos] = useState<Set<CampoDaFicha>>(new Set())
  const [leitura, setLeitura] = useState<LeituraDaFicha | null>(null)
  const [lendo, setLendo] = useState(false)
  const [telefone, setTelefone] = useState('')
  const [senhaGov, setSenhaGov] = useState<SenhaGov>({ situacao: 'sem-senha' })
  const [passo, setPasso] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [salvaEm, setSalvaEm] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterFicha(fichaId).then((f) => {
      if (!valendo) return
      setFicha(f)
      if (f) {
        setValores(valoresDa(f))
        setSenhaGov(f.senhaGov)
      }
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  if (!ficha || !valores) {
    return (
      <main className={proprio.vazia}>
        <title>Ficha de atendimento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{ficha === null ? 'Ficha não encontrada' : 'Abrindo a ficha…'}</h1>
        {ficha === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const erros = errosDaFicha(valores, hoje)
  const falta = oQueFalta(valores, hoje)
  const nascimentoIso = dataParaIso(normalizarData(valores.nascimento))
  const idade = nascimentoIso && !erros.nascimento ? `${idadeEm(nascimentoIso, hoje)} anos` : ''

  function mudar(p: Pergunta, valor: string) {
    setValores((v) => (v ? { ...v, [p.campo]: p.mascara ? soNumeroEMascara(valor) : valor } : v))
    setLidos((l) => {
      const novo = new Set(l)
      novo.delete(p.campo)
      return novo
    })
    if (p.campo === 'telefone') setTelefone('')
    setErro('')
  }

  async function sair(campo: CampoDaFicha) {
    setTocados((t) => new Set(t).add(campo))
    if (campo === 'telefone' && valores) {
      const r = await conferirTelefone(valores.telefone)
      setTelefone(r.valido ? `✓ conferido (${r.tipo})` : '')
    }
  }

  function dica(campo: CampoDaFicha): string | undefined {
    const partes = [
      campo === 'nascimento' ? idade : '',
      campo === 'telefone' ? telefone : '',
      lidos.has(campo) ? 'lido pela IA · confira' : '',
      leitura?.naoLidos.includes(campo as keyof EnvioDaFicha) && !valores?.[campo] ? 'a IA não leu: confira no papel' : '',
    ].filter(Boolean)
    return partes.length ? partes.join(' · ') : undefined
  }

  async function digitalizar() {
    setLendo(true)
    setErro('')
    try {
      const r = await lerFichaEmPapel(fichaId)
      const lido = daLeitura(r.campos)
      setLeitura(r)
      setValores((v) => (v ? { ...v, ...lido } : v))
      setLidos(new Set(Object.keys(lido) as CampoDaFicha[]))
      const atual = await obterFicha(fichaId)
      if (atual) setSenhaGov(atual.senhaGov)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ler a ficha.')
    } finally {
      setLendo(false)
    }
  }

  async function salvar(e?: FormEvent) {
    e?.preventDefault()
    setTocados(new Set(PERGUNTAS.map((p) => p.campo)))
    if (travado.current || falta.length > 0 || !valores) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const r = await salvarFichaDeAtendimento(fichaId, paraEnvio(valores, tablet ? 'tablet' : 'papel', tablet ? undefined : (leitura?.modelo ?? 'GGV')))
      if ('erro' in r) {
        setErro(`Este CPF já é da ficha de ${r.nome}: confira o número no papel.`)
        return
      }
      setFicha(r.ficha)
      setSalvaEm(agora().toISOString())
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  const campo = (p: Pergunta, grande = false) => (
    <Campo
      key={p.campo}
      id={`ficha-${p.campo}`}
      rotulo={grande ? p.pergunta : rotulo(p.campo)}
      valor={valores[p.campo]}
      aoMudar={(v) => mudar(p, v)}
      aoSair={() => sair(p.campo)}
      erro={tocados.has(p.campo) ? erros[p.campo] : undefined}
      opcoes={p.opcoes}
      inputMode={p.inputMode}
      maxLength={p.maxLength}
      placeholder={p.placeholder}
      dica={dica(p.campo)}
      largo
    />
  )

  const emBranco = ficha.fichaAtendimento?.emBranco ?? []
  const salvo = salvaEm && (
    <section className={styles.feito} aria-labelledby="ficha-salva">
      <h2 id="ficha-salva" className={styles.feitoTitulo}>
        ✓ Ficha salva às {hora(salvaEm)}
      </h2>
      <p>
        {tablet
          ? 'Obrigado! Sua ficha foi salva. Devolva o tablet ao balcão.'
          : `A ficha de ${ficha.nome} está pronta para o Jurídico ler antes da entrevista.${emBranco.length ? ` Ficou em branco: ${juntar(emBranco)}.` : ''}`}
      </p>
      {!tablet && (
        <div className={styles.atalhos}>
          <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
            Abrir a ficha do cliente
          </a>
          <a className={styles.atalho} href="/">
            Voltar ao início
          </a>
        </div>
      )}
    </section>
  )

  if (tablet) {
    const ultima = passo === PERGUNTAS.length
    const atual = PERGUNTAS[passo]
    const parado = atual && OBRIGATORIOS.includes(atual.campo) && erros[atual.campo] !== undefined
    return (
      <main className={proprio.tablet}>
        <title>Ficha de atendimento · GGV Previdenciário</title>
        <p className={proprio.tabletTopo}>Ficha de atendimento · Escritório GGV</p>
        <h1 className={proprio.tabletTitulo}>Olá! Responda uma pergunta por vez.</h1>
        {salvo || (
          <form
            className={proprio.tabletCartao}
            onSubmit={(e) => {
              e.preventDefault()
              if (!ultima && !parado) setPasso(passo + 1)
            }}
          >
            <p className={proprio.progresso}>
              Pergunta {passo + 1} de {PERGUNTAS.length + 1}
            </p>
            {ultima ? (
              <div className={proprio.tabletPergunta}>
                <p className={proprio.tabletRotulo}>Você sabe a senha do gov.br?</p>
                <p className={proprio.tabletAjuda}>Ela vai direto para o cofre do escritório e não fica na ficha.</p>
              </div>
            ) : (
              <div className={proprio.tabletPergunta}>{campo(atual, true)}</div>
            )}
            {!ultima && !OBRIGATORIOS.includes(atual.campo) && <p className={proprio.tabletAjuda}>Pode deixar em branco.</p>}
            <div className={proprio.tabletBotoes}>
              <button type="button" className={proprio.tabletBotao} disabled={passo === 0} onClick={() => setPasso(passo - 1)}>
                Voltar
              </button>
              {!ultima && (
                <button type="submit" className={proprio.tabletPrincipal} disabled={parado}>
                  Próxima
                </button>
              )}
            </div>
          </form>
        )}
        {!salvaEm && ultima && (
          <>
            <CampoCofre fichaId={ficha.id} senhaGov={senhaGov} aoMudar={setSenhaGov} />
            <button type="button" className={proprio.tabletPrincipal} disabled={falta.length > 0 || salvando} onClick={() => salvar()}>
              {salvando ? 'salvando…' : 'Salvar ficha'}
            </button>
            {falta.length > 0 && <p className={proprio.tabletAjuda}>Falta: {juntar(falta)}.</p>}
          </>
        )}
        {erro && (
          <p role="alert" className={styles.motivo}>
            {erro}
          </p>
        )}
      </main>
    )
  }

  const beneficio = nomeBeneficio(ficha.beneficioInteresse) || 'a definir'
  return (
    <>
      <title>{`${ficha.nome} · Preencher ficha · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${ficha.situacao === 'lead' ? 'Lead' : 'Cliente'} · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.05 · Preencher a ficha de atendimento (passo do BPMN)">
                D1.05
              </span>
              <span className={styles.codigo}>Cliente</span>
              <span className={styles.codigo}>{ficha.beneficioInteresse && ficha.beneficioInteresse !== 'nao-sei' ? beneficio : 'a definir'}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Preencher ficha
            </h1>
            <p className={styles.subtitulo}>triagem · {ficha.situacao}</p>
          </div>

          <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
            <div className={styles.instrucoesTopo}>
              <span className={styles.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
                O que você deve fazer
              </h2>
              <span className={styles.beneficio}>◆ {beneficio}</span>
              <span className={styles.instrucoesDe}>· {ficha.nome}</span>
            </div>
            <p className={styles.instrucoesTexto}>
              Preencha só o que a pessoa souber agora: dados pessoais, contato, última atividade, desde quando está sem
              trabalhar e o que já pediu ao INSS. Não peça diagnóstico nem sugira benefício: a IA sugere depois da
              entrevista e a advogada decide (G3). Se a pessoa disser a senha do gov.br, abra o cofre; ela nunca fica na
              ficha (G9).
            </p>
            <div className={styles.atalhos}>
              <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                Abrir a ficha do cliente
              </a>
              <button type="button" className={styles.atalho} aria-disabled="true">
                ▶ Entrevista e transcrições
              </button>
              <button type="button" className={styles.atalho} aria-disabled="true">
                Parecer médico
              </button>
            </div>
            <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="ficha-em-papel">
            <h2 id="ficha-em-papel" className={styles.cartaoTitulo}>
              Ficha em papel
            </h2>
            {leitura ? (
              <p className={proprio.texto} role="status">
                ✓ {leitura.arquivo.nome} em Documentos pessoais. A IA leu os campos marcados «lido pela IA · confira»
                {leitura.naoLidos.length > 0 && `; não leu: ${juntar(leitura.naoLidos.map((c) => ROTULOS_DA_FICHA[c as CampoDaFicha]))}`}.
                {leitura.senhaLida && ' A senha escrita no papel foi para o cofre: confira com o papel.'}
              </p>
            ) : (
              <>
                <p className={proprio.texto}>
                  Hoje a ficha é em papel (GGV ou APA), preenchida pela própria pessoa no balcão ou com quem a captou. Passe
                  no scanner: a imagem vai para a pasta do cliente e a IA preenche os campos abaixo para você conferir.
                </p>
                <button type="button" className={styles.atalho} disabled={lendo || salvaEm !== null} onClick={digitalizar}>
                  {lendo ? 'lendo a ficha…' : 'Digitalizar a ficha em papel (scanner simulado)'}
                </button>
              </>
            )}
          </section>

          <section className={`${styles.cartao} ${proprio.preencher}`} aria-labelledby="preencher">
            <h2 id="preencher" className={styles.cartaoTitulo}>
              Preencher
            </h2>
            <form id="ficha-de-atendimento" className={proprio.campos} onSubmit={salvar} noValidate>
              {PERGUNTAS.map((p) => campo(p))}
              <div className={proprio.dataDaFicha}>
                <span className={proprio.rotuloData}>Data da ficha</span>
                <span>{dataDaFicha(ficha)} · preenchida sozinha, sem edição</span>
              </div>
            </form>
            <CampoCofre fichaId={ficha.id} senhaGov={senhaGov} aoMudar={setSenhaGov} />
          </section>

          <p className={styles.trava}>A senha do gov.br vai para o cofre, nunca em campo de texto (G9).</p>

          {salvo}
          <div className={styles.rodape}>
            <button
              type="submit"
              form="ficha-de-atendimento"
              className={styles.principalBotao}
              disabled={falta.length > 0 || salvando}
            >
              {salvando ? 'salvando…' : salvaEm ? 'Salvar de novo' : 'Salvar ficha'}
            </button>
            {falta.length > 0 && <p className={styles.motivo}>Falta: {juntar(falta)}.</p>}
            {erro && (
              <p role="alert" className={styles.motivo}>
                {erro}
              </p>
            )}
          </div>
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.05.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            {PERGUNTAS.filter((p) => p.campo !== 'beneficioInteresse').map((p) => (
              <li key={p.campo}>• {ROTULOS_DA_FICHA[p.campo] + (OBRIGATORIOS.includes(p.campo) ? '*' : '')}</li>
            ))}
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Salvar ficha» só habilita com os campos com * preenchidos.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>
            Quem preenche é o cliente. Hoje a ficha é em papel (GGV ou APA) e é escaneada no balcão; a IA lê e o
            Atendimento confere. Esta tela é a do tablet, quando ele chegar (Lucas, 05/10).
          </p>
          <a className={styles.atalho} href={`/clientes/${ficha.id}/ficha-de-atendimento?modo=tablet`}>
            Abrir como no tablet
          </a>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}

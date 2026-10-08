import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import campoCss from '../componentes/Campo.module.css'
import { CampoCofre } from '../componentes/CampoCofre.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarCpf, formatarTelefone, isoParaData } from '../campos.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { lerSegundaFichaEmPapel, salvarSegundaFicha } from '../dados/segundaFicha.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { Arquivo, Ficha, RespostasDaSegundaFicha, SenhaGov } from '../dados/tipos.ts'
import { hojeIso, hora } from '../regras/datas.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import { SECOES, errosDaSegundaFicha, respostasVazias, type CampoDaSegunda, type DefinicaoDoCampo } from '../regras/segundaFicha.ts'
import styles from './Balcao.module.css'
import proprio from './SegundaFicha.module.css'

// Figma: "Segunda ficha: auxílio acidentário" (1815:422). O cartão manda nas seções: as 6 do modelo do escritório, no
// lugar dos campos de exemplo do Figma. Hoje em papel, conferida pelo Atendimento, que não vê a seção médica (CA8);
// com ?modo=tablet, a própria cliente preenche uma seção por tela.

type Props = { fichaId: string; tablet?: boolean }

export function SegundaFicha({ fichaId, tablet = false }: Props) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [respostas, setRespostas] = useState<RespostasDaSegundaFicha>(respostasVazias)
  const [tocados, setTocados] = useState<Set<CampoDaSegunda>>(new Set())
  const [lidos, setLidos] = useState<Set<CampoDaSegunda>>(new Set())
  const [arquivo, setArquivo] = useState<Arquivo | null>(null)
  const [lendo, setLendo] = useState(false)
  const [senhaGov, setSenhaGov] = useState<SenhaGov>({ situacao: 'sem-senha' })
  const [parte, setParte] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [salvaEm, setSalvaEm] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterFicha(fichaId).then((f) => {
      if (!valendo) return
      setFicha(f)
      if (f) {
        setSenhaGov(f.senhaGov)
        // O Atendimento nunca recebe a seção médica de volta (CA8).
        if (f.segundaFicha) setRespostas(tablet ? f.segundaFicha.respostas : { ...f.segundaFicha.respostas, doencas: '', cid: '', tratamento: '', cirurgia: '', medico: '', laudos: '' })
      }
    })
    return () => {
      valendo = false
    }
  }, [fichaId, tablet])

  if (!ficha) {
    return (
      <main className={proprio.vazia}>
        <title>Segunda ficha · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{ficha === null ? 'Ficha não encontrada' : 'Abrindo a ficha…'}</h1>
        {ficha === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const erros = errosDaSegundaFicha(respostas, hoje)
  const parado = Object.keys(erros).length > 0
  const secoes = SECOES.filter((s) => tablet || !s.medica)

  function mudar(c: DefinicaoDoCampo, valor: string) {
    setRespostas((r) => ({ ...r, [c.campo]: c.tipo === 'data' || c.tipo === 'nb' ? soNumeroEMascara(valor) : valor }))
    setLidos((l) => {
      const novo = new Set(l)
      novo.delete(c.campo)
      return novo
    })
    setErro('')
  }

  async function digitalizar() {
    setLendo(true)
    setErro('')
    try {
      const r = await lerSegundaFichaEmPapel(fichaId)
      setArquivo(r.arquivo)
      setRespostas(r.respostas)
      setLidos(new Set((Object.keys(r.respostas) as CampoDaSegunda[]).filter((c) => r.respostas[c] !== '')))
      const atual = await obterFicha(fichaId)
      if (atual) setSenhaGov(atual.senhaGov)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ler a ficha.')
    } finally {
      setLendo(false)
    }
  }

  async function enviar() {
    setTocados(new Set(SECOES.flatMap((s) => s.campos.map((c) => c.campo))))
    if (travado.current || parado) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const { ficha: salva } = await salvarSegundaFicha(fichaId, respostas, tablet ? 'tablet' : 'papel')
      setFicha(salva)
      setSalvaEm(agora().toISOString())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  function campo(c: DefinicaoDoCampo) {
    const id = `segunda-${c.campo}`
    const erroDoCampo = tocados.has(c.campo) ? erros[c.campo] : undefined
    const dica = lidos.has(c.campo) ? 'lido pela IA · confira' : undefined
    if (c.tipo === 'textoLongo') {
      return (
        <div key={c.campo} className={`${campoCss.campo} ${campoCss.largo}`}>
          <label className={campoCss.rotulo} htmlFor={id}>
            {c.rotulo}
          </label>
          <textarea
            id={id}
            className={campoCss.entrada}
            rows={tablet ? 6 : 4}
            maxLength={c.maximo}
            value={respostas[c.campo]}
            aria-invalid={erroDoCampo ? true : undefined}
            onChange={(e) => mudar(c, e.target.value)}
            onBlur={() => setTocados((t) => new Set(t).add(c.campo))}
          />
          {dica && <p className={campoCss.dica}>{dica}</p>}
          {erroDoCampo && <p className={campoCss.erro}>{erroDoCampo}</p>}
        </div>
      )
    }
    return (
      <Campo
        key={c.campo}
        id={id}
        rotulo={c.rotulo}
        valor={respostas[c.campo]}
        aoMudar={(v) => mudar(c, v)}
        aoSair={() => setTocados((t) => new Set(t).add(c.campo))}
        erro={erroDoCampo}
        opcoes={c.opcoes}
        inputMode={c.tipo === 'data' || c.tipo === 'nb' ? 'numeric' : undefined}
        maxLength={c.tipo === 'data' ? 10 : c.tipo === 'nb' ? 13 : c.maximo}
        placeholder={c.tipo === 'data' ? 'dd/mm/aaaa' : c.tipo === 'nb' ? '000.000.000-0' : undefined}
        dica={dica}
        largo
      />
    )
  }

  const dadosPessoais = (
    <section className={styles.cartao} aria-labelledby="secao-1">
      <h2 id="secao-1" className={styles.cartaoTitulo}>
        1. Atendimento e dados pessoais
      </h2>
      <dl className={proprio.pessoais}>
        <div>
          <dt>Nome</dt>
          <dd>{ficha.nome}</dd>
        </div>
        <div>
          <dt>CPF</dt>
          <dd>{ficha.cpf ? formatarCpf(ficha.cpf) : '—'}</dd>
        </div>
        <div>
          <dt>Data de nascimento</dt>
          <dd>{isoParaData(ficha.nascimento) ?? '—'}</dd>
        </div>
        <div>
          <dt>Telefone / WhatsApp</dt>
          <dd>{ficha.telefone ? formatarTelefone(ficha.telefone) : '—'}</dd>
        </div>
        <div>
          <dt>Data da segunda ficha</dt>
          <dd>{isoParaData(ficha.segundaFicha?.data ?? hoje)}</dd>
        </div>
      </dl>
      <p className={styles.nota}>Da ficha de atendimento: uma ficha só por pessoa, sem repetir.</p>
    </section>
  )

  function secao(s: (typeof SECOES)[number]) {
    return (
      <section key={s.numero} className={`${styles.cartao} ${proprio.secao}`} aria-labelledby={`secao-${s.numero}`}>
        <h2 id={`secao-${s.numero}`} className={styles.cartaoTitulo}>
          {s.numero}. {s.titulo}
        </h2>
        {s.campos.map(campo)}
        {s.numero === 3 && (
          <>
            <p className={proprio.texto}>A senha do Meu INSS é a mesma do gov.br: vai direto para o cofre, nunca para um campo da ficha (G9).</p>
            <CampoCofre fichaId={ficha!.id} senhaGov={senhaGov} aoMudar={setSenhaGov} />
          </>
        )}
      </section>
    )
  }

  const medicaEscondida = (
    <section className={styles.cartao} aria-labelledby="secao-5">
      <h2 id="secao-5" className={styles.cartaoTitulo}>
        5. Dados médicos
      </h2>
      <p className={proprio.texto}>
        Só o Jurídico vê.{' '}
        {arquivo ? 'A IA leu esta seção da ficha em papel e guardou para a advogada.' : 'A IA lê esta seção do papel e manda direto à advogada; no tablet, a própria cliente preenche.'}
      </p>
    </section>
  )

  const salvo = salvaEm && (
    <section className={styles.feito} aria-labelledby="segunda-salva">
      <h2 id="segunda-salva" className={styles.feitoTitulo}>
        ✓ Segunda ficha salva às {hora(salvaEm)}
      </h2>
      <p>{tablet ? 'Obrigado! Sua ficha foi salva. Devolva o tablet ao balcão.' : 'As duas fichas estão juntas para a advogada, e a entrevista está liberada.'}</p>
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

  const falta = parado && (
    <p className={tablet ? proprio.tabletAjuda : styles.motivo}>
      {erros.historico ? 'Falta: o que aconteceu (seção 6).' : 'Confira os campos marcados.'}
    </p>
  )

  if (tablet) {
    const partes = [dadosPessoais, ...secoes.map(secao)]
    const ultima = parte === partes.length - 1
    return (
      <main className={proprio.tablet}>
        <title>Segunda ficha · GGV Previdenciário</title>
        <p className={proprio.tabletTopo}>Ficha de auxílio acidente · Escritório GGV</p>
        <h1 className={proprio.tabletTitulo}>Conte como foi o acidente ou a doença ligada ao trabalho.</h1>
        {salvo || (
          <>
            <p className={proprio.progresso}>
              Parte {parte + 1} de {partes.length}
            </p>
            {partes[parte]}
            <div className={proprio.tabletBotoes}>
              <button type="button" className={proprio.tabletBotao} disabled={parte === 0} onClick={() => setParte(parte - 1)}>
                Voltar
              </button>
              {ultima ? (
                <button type="button" className={proprio.tabletPrincipal} disabled={parado || salvando} onClick={enviar}>
                  {salvando ? 'enviando…' : 'Enviar segunda ficha'}
                </button>
              ) : (
                <button type="button" className={proprio.tabletPrincipal} onClick={() => setParte(parte + 1)}>
                  Próxima
                </button>
              )}
            </div>
            {ultima && falta}
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
      <title>{`${ficha.nome} · Preencher segunda ficha · GGV Previdenciário`}</title>
      <TopoPasso contexto="Cliente · ficha em papel" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.07 · Preencher a segunda ficha (passo do BPMN)">
                D1.07
              </span>
              <span className={styles.codigo}>Cliente</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Preencher segunda ficha
            </h1>
            <p className={styles.subtitulo}>Preenchida pela própria cliente · auxílio acidentário</p>
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
            <p className={styles.instrucoesTexto}>Conte como foi o acidente ou a doença ligada ao trabalho.</p>
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

          <section className={styles.cartao} aria-labelledby="papel">
            <h2 id="papel" className={styles.cartaoTitulo}>
              Ficha em papel
            </h2>
            {arquivo ? (
              <p className={proprio.texto} role="status">
                ✓ {arquivo.nome} em Documentos pessoais. A IA leu os campos marcados «lido pela IA · confira»; a seção médica foi
                direto para a advogada e a senha do Meu INSS, para o cofre.
              </p>
            ) : (
              <>
                <p className={proprio.texto}>
                  Hoje a segunda ficha é em papel (FICHA DE ATENDIMENTO AUXILIO ACIDENTE), preenchida pela cliente. Passe no
                  scanner: a imagem vai para a pasta e a IA preenche os campos para você conferir.
                </p>
                <button type="button" className={styles.atalho} disabled={lendo || salvaEm !== null} onClick={digitalizar}>
                  {lendo ? 'lendo a ficha…' : 'Digitalizar a segunda ficha (scanner simulado)'}
                </button>
              </>
            )}
          </section>

          {dadosPessoais}
          {secoes.filter((s) => s.numero < 5).map(secao)}
          {medicaEscondida}
          {secoes.filter((s) => s.numero > 5).map(secao)}

          {salvo}
          <div className={styles.rodape}>
            <button type="button" className={styles.principalBotao} disabled={parado || salvando} onClick={enviar}>
              {salvando ? 'enviando…' : salvaEm ? 'Enviar de novo' : 'Enviar segunda ficha'}
            </button>
            {falta}
            {erro && (
              <p role="alert" className={styles.motivo}>
                {erro}
              </p>
            )}
          </div>
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}

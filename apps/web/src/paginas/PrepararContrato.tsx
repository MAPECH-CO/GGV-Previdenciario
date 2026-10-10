import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoContrato } from '../componentes/CabecalhoDoContrato.tsx'
import { CartaoDocumento } from '../componentes/CartaoDocumento.tsx'
import { CartaoKit } from '../componentes/CartaoKit.tsx'
import campoCss from '../componentes/Campo.module.css'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { camposDoCaso, gerarContrato, kitDeVerdade, obterContrato, type ContratoDoCaso } from '../dados/contrato.ts'
import {
  CONFERENCIAS,
  O_QUE_CONFERIR,
  corrigivel,
  erroDoCampo,
  HONORARIOS_DO_MODELO,
  modeloDoKit,
  motivoParadoDoGerar,
  type CampoDoModelo,
  type CampoPreenchido,
  type IdDaConferencia,
} from '../regras/contrato.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import styles from './Balcao.module.css'
import proprio from './PrepararContrato.module.css'

// Figma: step_D1.16 "Preparar contrato" (10:143). O kit do benefício (GGVP-65) não tem tela própria no Figma: o cartão pede
// que ele apareça aqui. O preenchimento e a conferência (GGVP-69): os campos com a origem, "O que conferir", as quatro
// conferências e a decisão "Os documentos foram aprovados?" no painel, como no desenho. O cartão manda nas conferências:
// são as quatro da trava do Figma, não as três caixas do cartão "Conferir" do desenho.

const NUMERICOS: CampoDoModelo[] = ['cpf', 'representanteCpf', 'telefone', 'curateladoCpf', 'curateladoNascimento']

export function PrepararContrato({ processoId }: { processoId: string }) {
  const [caso, setCaso] = useState<ContratoDoCaso | null | undefined>(undefined)
  const [aprovados, setAprovados] = useState<boolean | null>(null)
  const [oQueCorrigir, setOQueCorrigir] = useState('')
  const [conferencias, setConferencias] = useState<Partial<Record<IdDaConferencia, boolean>>>({})
  const [correcoes, setCorrecoes] = useState<Partial<Record<CampoDoModelo, string>>>({})
  const [erros, setErros] = useState<Partial<Record<CampoDoModelo, string>>>({})
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  /** O que o modelo pede e a ficha não tem (CA4): o kit não é gerado e a lista vem com o atalho para a ficha. */
  const [faltamNaFicha, setFaltamNaFicha] = useState<string[]>([])
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterContrato(processoId).then((c) => {
      if (valendo) setCaso(c)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!caso) {
    return (
      <main className={proprio.vazia}>
        <title>Preparar contrato · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Contrato não encontrado' : 'Abrindo a tarefa…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, contrato } = caso
  const { kit } = contrato
  const modelo = (kit && modeloDoKit(kit)) || null
  const preparando = contrato.etapa === 'preparar'
  const corrigindo = preparando && aprovados === false
  const campos = contrato.documento && !preparando ? contrato.documento.campos : camposDoCaso(caso, kitDeVerdade(processoId))
  const valorInicial = (c: CampoPreenchido) => (c.campo === 'representanteParentesco' ? (contrato.dados?.representanteParentesco ?? '') : c.valor)
  const valorDe = (c: CampoPreenchido) => correcoes[c.campo] ?? valorInicial(c)
  const faltam = campos.filter((c) => (corrigindo && corrigivel(c) ? valorDe(c) : c.valor).trim() === '').map((c) => c.campo)
  const comErro = corrigindo && (Object.entries(correcoes) as [CampoDoModelo, string][]).some(([campo, valor]) => erroDoCampo(campo, valor))
  const motivoParado = comErro ? 'Confira os campos marcados.' : motivoParadoDoGerar({ aprovados, oQueCorrigir, conferencias, faltam })
  const primeiro = ficha.nome.split(' ')[0]
  const instrucoes =
    kit && modelo
      ? `Gere o contrato de ${primeiro} pelo ${modelo.nome}, com o kit de ${kit.nome}: ${kit.documentos.length} documentos. Confira nome, CPF, ` +
        `endereço e honorários (${HONORARIOS_DO_MODELO}): o contrato cita o benefício certo. Se algo do modelo não ` +
        'bater com a ficha, corrija a ficha antes.'
      : kit
        ? `O kit de ${kit.nome} ainda não tem modelo do Word. Avise a gestão: nada vai para o cliente assinar sem o modelo certo.`
        : `${nomeBeneficio(processo.beneficio)} ainda não tem kit cadastrado. Avise a gestão: nada vai para o cliente assinar sem o kit certo.`

  function mudar(campo: CampoDoModelo, valor: string) {
    setCorrecoes((c) => ({ ...c, [campo]: NUMERICOS.includes(campo) ? soNumeroEMascara(valor) : valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  function sair(campo: CampoDoModelo) {
    const valor = correcoes[campo]
    if (valor !== undefined) setErros((e) => ({ ...e, [campo]: erroDoCampo(campo, valor) }))
  }

  async function gerar() {
    if (travado.current || motivoParado || aprovados === null) return
    travado.current = true
    setGerando(true)
    setErro('')
    setFaltamNaFicha([])
    try {
      const r = await gerarContrato(processoId, {
        aprovados,
        oQueCorrigir: aprovados ? undefined : oQueCorrigir,
        conferencias: Object.fromEntries(CONFERENCIAS.map((c) => [c.id, conferencias[c.id] === true])) as Record<IdDaConferencia, boolean>,
        correcoes: aprovados ? {} : correcoes,
      })
      if (r.resultado === 'gerado') setCaso(await obterContrato(processoId))
      else if (r.resultado === 'cpf-de-outra-ficha') setErros((e) => ({ ...e, cpf: `Este CPF já está na ficha de ${r.nome}.` }))
      else if (r.resultado === 'faltam') setErro('Ainda falta campo obrigatório: responda «Não, corrigir campos» e preencha.')
      else if (r.resultado === 'faltam-na-ficha') setFaltamNaFicha(r.faltam)
      else if (r.resultado === 'sem-modelo')
        setErro(r.modelo ? `Falta o ${r.modelo}: peça à Sênior para subir o modelo na Configuração do escritório.` : 'Este kit ainda não tem modelo do Word. Avise a gestão.')
      else setErro(`O texto ainda traz ${r.restos.join(', ')} do modelo. Avise a gestão: o modelo precisa ser convertido de novo.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para gerar.')
    } finally {
      travado.current = false
      setGerando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Preparar contrato · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoContrato
            passo="D1.16"
            nomeDoPasso="Preparar o contrato pelo modelo e conferir"
            tarefa="Preparar contrato"
            subtitulo={`${nomeBeneficio(processo.beneficio)} · ${modelo ? `pelo ${modelo.nome}` : kit ? 'falta o modelo' : 'sem kit cadastrado'}`}
            ficha={ficha}
            beneficio={processo.beneficio}
            instrucoes={instrucoes}
          />
          {preparando && contrato.anteriores && contrato.anteriores.length > 0 && (
            <p className={styles.aviso}>
              Voltou da conferência para corrigir: {contrato.anteriores.at(-1)!.motivo}. A versão {contrato.anteriores.at(-1)!.versao} assinada ficou
              guardada no histórico; a versão nova vai para o cliente assinar.
            </p>
          )}
          <CartaoKit
            processoId={processoId}
            beneficio={processo.beneficio}
            contrato={contrato}
            editavel={preparando}
            aoMudar={(c) => setCaso({ ...caso, contrato: c })}
          />

          {kit && modelo && (
            <>
              <CartaoDocumento campos={campos} modelo={modelo} corrigindo={corrigindo} valorDe={valorDe} erros={erros} aoMudar={mudar} aoSair={sair} />

              <section className={styles.cartao} aria-labelledby="o-que-conferir">
                <h2 id="o-que-conferir" className={styles.cartaoTitulo}>
                  O que conferir
                </h2>
                <ul className={proprio.lista}>
                  {O_QUE_CONFERIR.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              {corrigindo && (
                <section className={styles.cartao}>
                  <div className={campoCss.campo}>
                    <label className={campoCss.rotulo} htmlFor="o-que-corrigir">
                      O que corrigir *
                    </label>
                    <textarea
                      id="o-que-corrigir"
                      className={`${campoCss.entrada} ${proprio.texto}`}
                      rows={3}
                      maxLength={500}
                      value={oQueCorrigir}
                      onChange={(e) => setOQueCorrigir(e.target.value)}
                    />
                  </div>
                </section>
              )}

              {preparando ? (
                <>
                  <section className={`${styles.cartao} ${proprio.conferir}`} role="group" aria-labelledby="conferir-titulo">
                    <h2 id="conferir-titulo" className={styles.cartaoTitulo}>
                      Conferir
                    </h2>
                    {CONFERENCIAS.map((c) => (
                      <label key={c.id} className={proprio.conferencia}>
                        <input
                          type="checkbox"
                          checked={conferencias[c.id] === true}
                          onChange={(e) => setConferencias((atual) => ({ ...atual, [c.id]: e.target.checked }))}
                        />
                        {c.rotulo}
                      </label>
                    ))}
                  </section>

                  <div className={styles.rodape}>
                    <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || gerando} onClick={gerar}>
                      {gerando ? 'gerando…' : 'Gerar contrato'}
                    </button>
                    {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
                    {erro && (
                      <p role="alert" className={styles.motivo}>
                        {erro}
                      </p>
                    )}
                    {faltamNaFicha.length > 0 && (
                      <div role="alert" className={styles.aviso}>
                        <p>O kit não foi gerado. Falta na ficha: {faltamNaFicha.join(', ')}.</p>
                        <a className={styles.avisoLink} href={`/clientes/${ficha.id}`}>
                          Completar a ficha
                        </a>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <section className={styles.feito} aria-labelledby="contrato-gerado">
                  <h2 id="contrato-gerado" className={styles.feitoTitulo}>
                    ✓ Contrato gerado · versão {contrato.documento?.versao}
                  </h2>
                  <p>O kit foi gerado pelo {modelo.nome} e segue para colher a assinatura do cliente.</p>
                  <div className={styles.atalhos}>
                    <a className={styles.atalho} href={`/contrato/${processoId}/assinatura`}>
                      Colher assinatura
                    </a>
                    <a className={styles.atalho} href="/">
                      Voltar ao início
                    </a>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.16.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="aprovados">Os documentos foram aprovados?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="aprovados">
              <button
                type="button"
                role="radio"
                className={styles.chip}
                aria-checked={aprovados === true}
                disabled={!preparando || !kit}
                onClick={() => setAprovados(true)}
              >
                Sim
              </button>
              <button
                type="button"
                role="radio"
                className={styles.chip}
                aria-checked={aprovados === false}
                disabled={!preparando || !kit}
                onClick={() => setAprovados(false)}
              >
                Não, corrigir campos
              </button>
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Se «Não, corrigir campos»: O que corrigir*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <ul className={styles.ladoLista}>
            {CONFERENCIAS.map((c) => (
              <li key={c.id}>Conferir: {c.rotulo}</li>
            ))}
          </ul>
          <p className={styles.ladoSub}>
            «Gerar contrato» só habilita com as decisões respondidas, os campos com * preenchidos e as conferências marcadas.
          </p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}

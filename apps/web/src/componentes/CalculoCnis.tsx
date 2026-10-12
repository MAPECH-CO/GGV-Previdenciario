import { useState } from 'react'
import { calcularCnis, type EntradaDoCnis } from '@ggv/contratos'
import { formatarDecimal, isoParaData, normalizarData } from '../campos.ts'
import { Campo } from './Campo.tsx'
import styles from '../paginas/Balcao.module.css'
import proprio from '../paginas/CalcularTempo.module.css'

const SITUACOES = [
  { id: 'pendente', nome: 'Ainda não conferido' },
  { id: 'conferido', nome: 'Conferido: conta' },
  { id: 'nao-conta', nome: 'Conferido: não conta' },
]
const periodoVazio = () => ({ inicio: '', fim: '', tempo: 'pendente' as const, carencia: 'pendente' as const })
const competenciaFalando = (c: string) => c.slice(5) + '/' + c.slice(0, 4)

/** Rascunho somente em memória. A API atual não recebe os vínculos nem a carência. */
export function CalculoCnis({ nascimento, hoje }: { nascimento?: string; hoje: string }) {
  const hojeBr = isoParaData(hoje) ?? ''
  const [entrada, setEntrada] = useState<EntradaDoCnis>({ nascimento: isoParaData(nascimento) ?? '', referencia: hojeBr, vinculos: [periodoVazio()], excecoes: [] })
  const [resultado, setResultado] = useState<ReturnType<typeof calcularCnis> | null>(null)
  const mudar = (nova: EntradaDoCnis) => { setEntrada(nova); setResultado(null) }
  const periodo = (i: number, campo: string, valor: string) => mudar({ ...entrada, vinculos: entrada.vinculos.map((v, n) => n === i ? { ...v, [campo]: valor } : v) })
  const excecao = (i: number, campo: string, valor: string) => mudar({ ...entrada, excecoes: entrada.excecoes.map((v, n) => n === i ? { ...v, [campo]: valor } : v) })
  return <section className={styles.cartao} aria-labelledby="memoria-cnis">
    <h2 id="memoria-cnis" className={styles.cartaoTitulo}>Digitar vínculos do CNIS</h2>
    <p className={styles.nota}>Use o CNIS impresso ou baixado do Meu INSS. Esta memória conta tempo comum do RGPS; não decide direito ao benefício.</p>
    <p className={proprio.alerta}>Rascunho nesta tela: não fica salvo e não segue para a Sênior. Salvar o cálculo por caso ainda não está disponível.</p>
    <p className={styles.nota}>Converta períodos especiais, rurais, de deficiência e de outros regimes em análise própria. Não os marque como tempo comum conferido aqui.</p>
    <div className={proprio.linha}>
      <Campo id="cnis-nascimento" rotulo="Nascimento para o cálculo" valor={entrada.nascimento} aoMudar={v => mudar({ ...entrada, nascimento: normalizarData(v) })} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} />
      <Campo id="cnis-referencia" rotulo="Data de referência" valor={entrada.referencia} aoMudar={v => mudar({ ...entrada, referencia: normalizarData(v) })} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} />
    </div>
    <p className={styles.nota}>Confira tempo e carência separadamente. Divida o vínculo se houver afastamentos ou mudança de situação. Para um vínculo aberto, informe o último dia conferido, até a referência.</p>
    {entrada.vinculos.map((v, i) => <fieldset className={proprio.grupo} key={i}>
      <legend className={proprio.legenda}>Vínculo {i + 1}</legend>
      <div className={proprio.linha}>
        <Campo id={'cnis-inicio-' + i} rotulo={'Início do vínculo ' + (i + 1)} valor={v.inicio} aoMudar={x => periodo(i, 'inicio', normalizarData(x))} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} />
        <Campo id={'cnis-fim-' + i} rotulo={'Fim do vínculo ' + (i + 1)} valor={v.fim} aoMudar={x => periodo(i, 'fim', normalizarData(x))} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} />
        <Campo id={'cnis-tempo-' + i} rotulo={'Tempo do vínculo ' + (i + 1)} valor={v.tempo} aoMudar={x => periodo(i, 'tempo', x)} opcoes={SITUACOES} />
        <Campo id={'cnis-carencia-' + i} rotulo={'Carência do vínculo ' + (i + 1)} valor={v.carencia} aoMudar={x => periodo(i, 'carencia', x)} opcoes={SITUACOES} />
      </div>
      <button type="button" className={styles.atalho} onClick={() => mudar({ ...entrada, vinculos: entrada.vinculos.filter((_, n) => n !== i) })}>Remover vínculo {i + 1}</button>
    </fieldset>)}
    <button type="button" className={styles.atalho} disabled={entrada.vinculos.length >= 100} onClick={() => mudar({ ...entrada, vinculos: [...entrada.vinculos, periodoVazio()] })}>Adicionar vínculo</button>
    <h3 className={styles.cartaoTitulo}>Competências com exceção</h3>
    <p className={styles.nota}>Informe meses abaixo do mínimo sem ajuste, indicadores ou recolhimentos sem validade para carência. Confira a soma das remunerações de todos os vínculos do mês. A exceção vale para todos eles e não aprova vínculo pendente.</p>
    {entrada.excecoes.map((e, i) => <fieldset className={proprio.grupo} key={i}>
      <legend className={proprio.legenda}>Exceção {i + 1}</legend>
      <div className={proprio.linha}>
        <Campo id={'cnis-mes-' + i} rotulo={'Competência da exceção ' + (i + 1)} valor={e.competencia} aoMudar={x => excecao(i, 'competencia', x)} placeholder="mm/aaaa" inputMode="numeric" maxLength={7} />
        <Campo id={'cnis-ex-tempo-' + i} rotulo={'Tempo da exceção ' + (i + 1)} valor={e.tempo} aoMudar={x => excecao(i, 'tempo', x)} opcoes={SITUACOES} />
        <Campo id={'cnis-ex-carencia-' + i} rotulo={'Carência da exceção ' + (i + 1)} valor={e.carencia} aoMudar={x => excecao(i, 'carencia', x)} opcoes={SITUACOES} />
      </div>
      <button type="button" className={styles.atalho} onClick={() => mudar({ ...entrada, excecoes: entrada.excecoes.filter((_, n) => n !== i) })}>Remover exceção {i + 1}</button>
    </fieldset>)}
    <button type="button" className={styles.atalho} disabled={entrada.excecoes.length >= 600} onClick={() => mudar({ ...entrada, excecoes: [...entrada.excecoes, { competencia: '', tempo: 'pendente', carencia: 'pendente' }] })}>Adicionar competência com exceção</button>
    <div className={styles.rodape}>
      <button type="button" className={styles.principalBotao} onClick={() => setResultado(calcularCnis(entrada, hojeBr))}>Calcular prévia</button>
      <button type="button" className={styles.atalho} disabled>Salvar cálculo no caso · indisponível</button>
    </div>
    {resultado && (!resultado.ok ? <p role="alert" className={proprio.alerta}>{[...new Set(resultado.erros)].join(' ')}</p> : <div role="status">
      <h3 className={styles.cartaoTitulo}>{resultado.parcial ? 'Prévia parcial: há competências pendentes' : 'Memória dos períodos conferidos'}</h3>
      <dl className={proprio.linhas}>
        <div className={proprio.item}><dt>Tempo contado de data a data</dt><dd>{resultado.diasDeTempo} dias, sem duplicar sobreposições</dd></div>
        <div className={proprio.item}><dt>Tempo desde novembro de 2019</dt><dd>{resultado.competenciasIntegrais} competências integrais</dd></div>
        <div className={proprio.item}><dt>Tempo total na convenção de cálculo</dt><dd>{resultado.diasTotais} dias</dd></div>
        <div className={proprio.item}><dt>Carência</dt><dd>{resultado.carencia} competências conferidas, sem duplicar meses</dd></div>
        <div className={proprio.item}><dt>Pontos</dt><dd>{formatarDecimal(Math.floor(resultado.pontos * 100) / 100, 2)} pontos dos períodos conferidos</dd></div>
      </dl>
      <p className={styles.nota}>Parcela mensal: grupos de 12 competências = 365 dias; cada mês restante = 30 dias. {resultado.diasDeTempo} dias anteriores + {resultado.diasDaParcelaMensal} dias da parcela mensal. Pontos: ({resultado.idadeDias} dias de idade + {resultado.diasTotais} dias de tempo) ÷ 365. Exibição truncada em duas casas.</p>
      {resultado.competenciasPendentes.length > 0 && <p className={proprio.alerta}>Pendentes: {resultado.competenciasPendentes.map(competenciaFalando).join(', ')}. Só as parcelas conferidas entraram na prévia.</p>}
      {resultado.competenciasExcluidas.length > 0 && <p className={styles.nota}>Com exclusão de tempo ou carência: {resultado.competenciasExcluidas.map(competenciaFalando).join(', ')}.</p>}
      <p className={styles.nota}>A advogada confere os dados e decide a regra aplicável. Esta prévia não libera o caso nem registra uma decisão.</p>
    </div>)}
    <p className={styles.nota}>Base: <a href="https://portalin.inss.gov.br/in/214" target="_blank" rel="noreferrer">IN 128, arts. 190, 191 e 206 a 210</a>; <a href="https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" target="_blank" rel="noreferrer">EC 103, art. 15</a>. Versão da memória: rgps-comum-1.</p>
  </section>
}

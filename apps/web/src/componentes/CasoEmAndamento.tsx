import { nomeBeneficio } from '../dados/catalogos.ts'
import { doJuridico, parecerParaOPortao } from '../dados/parecer.ts'
import { etapaDaPericia } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { doServidor, ler } from '../dados/servidor.ts'
import type { Ficha, Processo } from '../dados/tipos.ts'
import { calculoPendente } from '../regras/calculo.ts'
import { precisaDeParecer } from '../regras/liberacao.ts'
import { usePode } from '../sessao.ts'
import { Cartao } from './Cartao.tsx'
import styles from './CasoEmAndamento.module.css'

/** "Caso em andamento" (Figma 73:351): um cartão por processo. A visão do Atendimento nunca traz petição nem valores. */
export function CasoEmAndamento({ ficha }: { ficha: Ficha }) {
  const { processos } = ficha
  return (
    <Cartao titulo={processos.length > 1 ? 'Casos em andamento' : 'Caso em andamento'}>
      {/* O caso novo do lead, com o benefício definido pela advogada (GGVP-51) e o cálculo que falta (GGVP-57, CA1). */}
      {processos.length === 0 && ficha.beneficioDefinido && (
        <div className={styles.caso}>
          <span className={styles.numero}>Caso novo · sem processo ainda</span>
          <span className={styles.selos}>
            <span className={styles.beneficio}>◆ {nomeBeneficio(ficha.beneficioDefinido.beneficio)}</span>
            <span className={styles.etapa}>benefício definido pela advogada</span>
          </span>
          {calculoPendente(ficha) && <span className={styles.urgente}>Calcular tempo e pontos (D1.13): obrigatório antes do fechamento</span>}
        </div>
      )}
      {processos.length === 0 && !ficha.beneficioDefinido && (
        <p className={styles.vazio}>
          Nenhum caso aberto ainda.
          {ficha.beneficioInteresse && ` Interesse: ${nomeBeneficio(ficha.beneficioInteresse)}.`}
        </p>
      )}
      {processos.map((p) => {
        // Em perícia (GGVP-49, CA1): a etapa diz o diagrama de origem e o caso abre a página do processo com a perícia.
        const pericia = etapaDaPericia(p.id)
        return [
          <a key={p.id} className={styles.caso} href={pericia ? `/casos/${p.id}/pericia` : `/casos/${p.id}`}>
            <span className={styles.numero}>{p.numero ?? 'Processo ainda sem número'}</span>
            <span className={styles.selos}>
              <span className={styles.beneficio}>◆ {nomeBeneficio(p.beneficio)}</span>
              <span className={styles.etapa}>{p.etapa}</span>
              {pericia && <span className={styles.etapa}>{pericia}</span>}
            </span>
            {p.proximaAcao && <span className={styles.acao}>O que o Atendimento faz agora: {p.proximaAcao}.</span>}
            {/* A perícia é toda do Jurídico administrativo desde 29/09 (Lucas): o Atendimento não age nela. */}
            {pericia && <span className={styles.acao}>A perícia está com o Jurídico administrativo.</span>}
            {p.prazo && <span className={p.urgente ? styles.urgente : styles.prazo}>{p.prazo}</span>}
          </a>,
          <AtalhosDoCaso key={`${p.id}-atalhos`} processo={p} />,
        ]
      })}
      <p className={styles.nota}>Petição, estratégia e valores não aparecem para o Atendimento.</p>
    </Cartao>
  )
}

/**
 * GGVP-135: o que cada perfil abre do caso a partir da ficha, por clique (P12 e P13 do roteiro de 09/10). O histórico do
 * processo é do servidor; a linha do tempo da deficiência e a dispensa do parecer, pelo perfil, no caso da semente e no do
 * servidor (GGVP-137: as rotas existem nos dois; o parecer do caso do servidor vem da sincronização da documentação médica).
 */
function AtalhosDoCaso({ processo: p }: { processo: Processo }) {
  const perfil = usePerfil()?.id
  const veCaso = usePode('caso.ver')
  const semente = !doServidor(p.id)
  const senior = perfil?.startsWith('senior') === true
  // Só a sênior dispensa (GGVP-33); com o parecer suficiente ou já dispensado, não há o que dispensar.
  const situacao = senior && precisaDeParecer(p.beneficio) ? (parecerParaOPortao(ler(), p.id)?.situacao ?? 'sem-parecer') : undefined
  const atalhos = [
    veCaso && !semente && { rotulo: 'Histórico do processo', href: `/casos/${p.id}/historico` },
    doJuridico(perfil) && p.beneficio.startsWith('aposentadoria-pcd') && { rotulo: 'Linha do tempo da deficiência', href: `/casos/${p.id}/deficiencia` },
    situacao && situacao !== 'suficiente' && situacao !== 'dispensado' && { rotulo: 'Dispensar o parecer', href: `/casos/${p.id}/parecer/dispensa` },
  ].filter((a) => !!a)
  if (!atalhos.length) return null
  return (
    <ul className={styles.atalhos} aria-label={`Atalhos do caso ${p.numero ?? nomeBeneficio(p.beneficio)}`}>
      {atalhos.map((a) => (
        <li key={a.href}>
          <a href={a.href}>{a.rotulo}</a>
        </li>
      ))}
    </ul>
  )
}

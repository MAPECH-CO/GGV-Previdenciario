import { useState } from 'react'
import { ROTULO_DO_SETOR, type QuadroDoSetor, type TarefaDoSetor } from '@ggv/contratos'
import { useSessao } from '../sessao.ts'
import { AtribuirTarefa, iniciais } from './AtribuirTarefa.tsx'
import styles from './TarefasDoSetor.module.css'

/**
 * "Tarefas do setor" do líder (GGVP-147; Figma 1600:90 no Atendimento e 1600:672 no Jurídico): todas as tarefas abertas do
 * setor, de quem é cada uma e o prazo, com "Atribuir". Sem responsável e urgentes primeiro (G15).
 */
export function TarefasDoSetor({ quadro, erro, recarregar }: { quadro: QuadroDoSetor | null; erro: string; recarregar: () => void }) {
  const eu = useSessao()?.nome
  const [filtro, setFiltro] = useState<string>('todos')
  const [aberta, setAberta] = useState<TarefaDoSetor | null>(null)

  if (!quadro) return <p className={styles.vazio}>{erro || 'Abrindo as tarefas do setor…'}</p>

  const nomeDe = (nome: string) => (nome === eu ? 'Você' : nome)
  const semResponsavel = quadro.tarefas.filter((t) => !t.responsavel)
  const comAlguem = quadro.pessoas.filter((p) => quadro.tarefas.some((t) => t.responsavel?.id === p.id))
  const filtros = [
    { id: 'todos', rotulo: `Todos (${quadro.tarefas.length})` },
    { id: 'sem', rotulo: `Sem responsável (${semResponsavel.length})`, alerta: true },
    ...comAlguem.map((p) => ({ id: p.id, rotulo: `${nomeDe(p.nome)} (${quadro.tarefas.filter((t) => t.responsavel?.id === p.id).length})` })),
  ]
  const visiveis = quadro.tarefas.filter((t) => (filtro === 'todos' ? true : filtro === 'sem' ? !t.responsavel : t.responsavel?.id === filtro))

  return (
    <>
      <div className={styles.titulo}>
        <h2 className={styles.tituloTexto}>Tarefas do setor · {ROTULO_DO_SETOR[quadro.setor]}</h2>
        <span className={styles.contagem}>{quadro.tarefas.length}</span>
      </div>
      <div className={styles.filtros} role="group" aria-label="Ver">
        <span className={styles.ver}>Ver:</span>
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            className={`${styles.filtro} ${filtro === f.id ? styles.ativo : ''} ${'alerta' in f ? styles.filtroAlerta : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <p className={styles.vazio}>Nenhuma tarefa aberta aqui.</p>
      ) : (
        <ul className={styles.lista} aria-label="Tarefas do setor">
          {visiveis.map((t) => (
            <li key={t.id} className={`${styles.linha} ${t.urgente ? styles.urgente : ''}`}>
              <span className={styles.ponto} aria-hidden="true" />
              <div className={styles.corpo}>
                <div className={styles.cabeca}>
                  {t.codigo && <span className={styles.codigo}>{t.codigo}</span>}
                  <span className={styles.texto}>
                    <strong>{t.cliente?.nome ?? t.contexto}</strong> · {t.acao}
                  </span>
                </div>
                <p className={styles.detalhe}>{t.detalhe}</p>
              </div>
              {t.responsavel ? (
                <span className={styles.responsavel}>
                  <span className={styles.avatar} aria-hidden="true">
                    {iniciais(nomeDe(t.responsavel.nome))}
                  </span>
                  {nomeDe(t.responsavel.nome)}
                </span>
              ) : (
                <span className={styles.semResponsavel}>sem responsável</span>
              )}
              {t.prazo && <span className={`${styles.prazo} ${t.urgente ? styles.prazoUrgente : ''}`}>{t.prazo}</span>}
              <button
                type="button"
                className={styles.atribuir}
                aria-label={`${t.responsavel ? 'Reatribuir' : 'Atribuir'}: ${t.cliente?.nome ?? t.contexto ?? ''} · ${t.acao}`}
                onClick={() => setAberta(t)}
              >
                {t.responsavel ? 'Reatribuir' : 'Atribuir'} ▾
              </button>
              {t.href ? (
                <a className={styles.seta} href={t.href} aria-label={`Abrir: ${t.cliente?.nome ?? t.contexto ?? ''} · ${t.acao}`}>
                  ›
                </a>
              ) : (
                <span className={styles.seta} aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.nota}>
        Você é líder do {ROTULO_DO_SETOR[quadro.setor]}: vê tudo do setor e escolhe quem faz cada tarefa (Atribuir). Tarefa sem responsável ou com
        prazo estourado aparece aqui primeiro (G15).
      </p>
      {aberta && (
        <AtribuirTarefa
          tarefa={aberta}
          pessoas={quadro.pessoas}
          eu={eu}
          aoFechar={() => setAberta(null)}
          aoAtribuir={() => {
            setAberta(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}

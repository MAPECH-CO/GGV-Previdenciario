import { useEffect, useId, useState } from 'react'
import { somenteDigitos } from '@ggv/campos'
import { BENEFICIOS, ROTULO_BENEFICIO, type Beneficio, type ConfiguracaoDoEscritorio } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { FeriadosDosTribunais } from '../componentes/FeriadosDosTribunais.tsx'
import styles from './Passo.module.css'

type Config = ConfiguracaoDoEscritorio
type ItemDoKit = Config['kits'][number]['itens'][number]
const momento = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** Um parâmetro: número inteiro pelo `campos`, salvo um por vez (GGVP-104 CA4). */
function LinhaDoParametro({ p, podeEditar, aoSalvar }: { p: Config['parametros'][number]; podeEditar: boolean; aoSalvar: (chave: string, valor: string) => void }) {
  const id = useId()
  const [valor, setValor] = useState(p.valor === null ? '' : String(p.valor))
  return (
    <div className={styles.escolha}>
      <label className={styles.rotulo} htmlFor={id}>
        {p.rotulo} (de {p.min} a {p.max})
      </label>
      <input id={id} className={styles.campo} inputMode="numeric" value={valor} disabled={!podeEditar} onChange={(e) => setValor(somenteDigitos(e.target.value))} />
      {podeEditar && (
        <button
          type="button"
          className={styles.botao}
          aria-label={`Salvar: ${p.rotulo}`}
          disabled={!valor || valor === String(p.valor)}
          onClick={() => aoSalvar(p.chave, valor)}
        >
          Salvar
        </button>
      )}
    </div>
  )
}

/** O kit de um benefício (CA1): a versão vigente, e a seguinte, montada aqui e publicada de uma vez. */
function KitDoBeneficio({ kit, tipos, podeEditar, aoPublicar }: { kit: Config['kits'][number]; tipos: string[]; podeEditar: boolean; aoPublicar: (itens: ItemDoKit[]) => void }) {
  const idNovo = useId()
  const idLista = useId()
  const [itens, setItens] = useState<ItemDoKit[]>(kit.itens)
  const [novo, setNovo] = useState('')
  const mudou = JSON.stringify(itens) !== JSON.stringify(kit.itens)
  return (
    <section className={styles.cartao} aria-label={`Kit de ${ROTULO_BENEFICIO[kit.beneficio]}`}>
      <p className={styles.dica}>
        {kit.versao ? `Versão ${kit.versao}, desde ${momento(kit.vigenteDesde!)}.` : 'Sem kit cadastrado: a conferência avisa (G1).'} A versão nova vale para os casos
        novos; o caso aberto fica com o kit da época.
      </p>
      {itens.length > 0 && (
        <ul className={styles.lista} aria-label="Documentos do kit">
          {itens.map((i) => (
            <li key={i.tipoDocumento}>
              <label className={styles.escolha}>
                <input
                  type="checkbox"
                  checked={i.obrigatorio}
                  disabled={!podeEditar}
                  onChange={() => setItens((a) => a.map((x) => (x.tipoDocumento === i.tipoDocumento ? { ...x, obrigatorio: !x.obrigatorio } : x)))}
                />
                {i.tipoDocumento} · {i.obrigatorio ? 'obrigatório' : 'condicional'}
              </label>
              {podeEditar && (
                <button type="button" className={styles.botao} onClick={() => setItens((a) => a.filter((x) => x.tipoDocumento !== i.tipoDocumento))}>
                  Tirar {i.tipoDocumento}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && (
        <>
          <label className={styles.rotulo} htmlFor={idNovo}>
            Acrescentar documento
          </label>
          <input id={idNovo} className={styles.campo} list={idLista} value={novo} onChange={(e) => setNovo(e.target.value)} />
          <datalist id={idLista}>
            {tipos.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.botao}
              disabled={!novo.trim() || itens.some((i) => i.tipoDocumento === novo.trim())}
              onClick={() => {
                setItens((a) => [...a, { tipoDocumento: novo.trim(), obrigatorio: true }])
                setNovo('')
              }}
            >
              Acrescentar
            </button>
            <button type="button" className={styles.botao} disabled={!mudou || itens.length === 0} onClick={() => aoPublicar(itens)}>
              Publicar a versão {(kit.versao ?? 0) + 1}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/** Uma mensagem padrão (CA3): publicar cria a versão nova e guarda a anterior. */
function Mensagem({ m, podeEditar, aoPublicar }: { m: Config['mensagens'][number]; podeEditar: boolean; aoPublicar: (id: string, conteudo: string) => void }) {
  const id = useId()
  const [conteudo, setConteudo] = useState(m.conteudo)
  return (
    <div>
      <label className={styles.rotulo} htmlFor={id}>
        {m.nome}
      </label>
      <textarea id={id} className={styles.campo} rows={3} value={conteudo} disabled={!podeEditar} onChange={(e) => setConteudo(e.target.value)} />
      {podeEditar && (
        <div className={styles.acoes}>
          <button type="button" className={styles.botao} disabled={!conteudo.trim() || conteudo === m.conteudo} onClick={() => aoPublicar(m.id, conteudo)}>
            Publicar a mensagem
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Configuração do escritório (GGVP-104): limites dos laços, kits por benefício e mensagens padrão, numa tela só.
 * A gestão vê; o Sócio e a Sênior mudam. Toda mudança vai para o histórico, que aparece no fim da tela (CA3).
 */
export function Configuracao() {
  const idBeneficio = useId()
  const [c, setC] = useState<Config | null>(null)
  const [versao, setVersao] = useState(0)
  const [beneficio, setBeneficio] = useState<Beneficio>('bpc_loas_idoso')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<Config>('/configuracao').then((r) => (r.ok ? setC(r.dados) : setErro(r.erro)))
  }, [versao])

  async function salvar(caminho: string, corpo: unknown, aviso: string) {
    const r = await chamarApi(caminho, { method: 'PUT', corpo })
    if (!r.ok) {
      setFeito('')
      return setErro(r.erro)
    }
    setErro('')
    setFeito(aviso)
    setVersao((v) => v + 1)
  }

  const kit = c?.kits.find((k) => k.beneficio === beneficio)
  return (
    <main className={styles.pagina}>
      <title>Configuração do escritório · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Configuração do escritório</h1>
      <p className={styles.subtitulo}>Mudar a regra do escritório sem mexer no código. Toda mudança fica no histórico, com quem mudou.</p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {c && (
        <>
          <section className={styles.cartao} aria-label="Limites e parâmetros" key={`p-${versao}`}>
            <h2 className={styles.cartaoTitulo}>Limites e parâmetros</h2>
            {c.parametros.map((p) => (
              <LinhaDoParametro key={p.chave} p={p} podeEditar={c.podeEditar} aoSalvar={(chave, valor) => void salvar(`/configuracao/parametros/${chave}`, { valor }, 'Parâmetro salvo.')} />
            ))}
          </section>

          <section className={styles.cartao} aria-label="Kits por benefício">
            <h2 className={styles.cartaoTitulo}>Kits de documentos por benefício</h2>
            <label className={styles.rotulo} htmlFor={idBeneficio}>
              Benefício
            </label>
            <select id={idBeneficio} className={styles.campo} value={beneficio} onChange={(e) => setBeneficio(e.target.value as Beneficio)}>
              {BENEFICIOS.map((b) => (
                <option key={b} value={b}>
                  {ROTULO_BENEFICIO[b]}
                </option>
              ))}
            </select>
            {kit && (
              <KitDoBeneficio
                key={`${beneficio}-${kit.versao}-${versao}`}
                kit={kit}
                tipos={c.tiposDeDocumento}
                podeEditar={c.podeEditar}
                aoPublicar={(itens) => void salvar(`/configuracao/kits/${beneficio}`, { itens }, `Kit publicado: a versão ${(kit.versao ?? 0) + 1} vale para os casos novos.`)}
              />
            )}
          </section>

          {c.mensagens.length > 0 && (
            <section className={styles.cartao} aria-label="Mensagens padrão" key={`m-${versao}`}>
              <h2 className={styles.cartaoTitulo}>Mensagens padrão</h2>
              {c.mensagens.map((m) => (
                <Mensagem key={m.id} m={m} podeEditar={c.podeEditar} aoPublicar={(id, conteudo) => void salvar(`/configuracao/mensagens/${id}`, { conteudo }, 'Mensagem publicada.')} />
              ))}
            </section>
          )}

          {c.historico.length > 0 && (
            <section className={styles.cartao} aria-label="Histórico da configuração">
              <h2 className={styles.cartaoTitulo}>Histórico da configuração</h2>
              <ol className={styles.lista}>
                {c.historico.map((h, i) => (
                  <li key={`${h.quando}-${i}`}>
                    {momento(h.quando)} · {h.quem} · {h.descricao}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      {/* GGVP-146, parte 3: os feriados e as suspensões dos tribunais, com o histórico deles. */}
      {c && <FeriadosDosTribunais />}
    </main>
  )
}

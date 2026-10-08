import { useEffect, useId, useState } from 'react'
import { somenteDigitos } from '@ggv/campos'
import {
  BENEFICIOS,
  ROTULO_BENEFICIO,
  ROTULO_TIPO_DE_TERMO,
  SalvarTermo,
  TIPOS_DE_TERMO,
  type Beneficio,
  type ConfiguracaoDoEscritorio,
  type GlossarioDoEscritorio,
  type TipoDeTermo,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
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

type Termo = GlossarioDoEscritorio['termos'][number]
type Salvar = (caminho: string, corpo: unknown, aviso: string, metodo?: string) => void
const TERMO_VAZIO: SalvarTermo = { termo: '', tipo: 'sigla', significado: '' }

/** O termo, o tipo e o significado (GGVP-143): o mesmo formulário acrescenta e corrige; o contrato confere antes de enviar. */
function FormularioDoTermo({ inicial, rotulo, aoSalvar, aoCancelar }: { inicial: SalvarTermo; rotulo: string; aoSalvar: (t: SalvarTermo) => void; aoCancelar?: () => void }) {
  const id = useId()
  const [t, setT] = useState(inicial)
  const [erro, setErro] = useState('')
  function enviar() {
    const r = SalvarTermo.safeParse(t)
    if (!r.success) return setErro(r.error.issues[0]?.message ?? 'Confira o termo.')
    setErro('')
    aoSalvar(t)
  }
  return (
    <div role="group" aria-label={rotulo} className={styles.cartao}>
      <label className={styles.rotulo} htmlFor={`${id}-termo`}>
        Termo
      </label>
      <input id={`${id}-termo`} className={styles.campo} value={t.termo} onChange={(e) => setT({ ...t, termo: e.target.value })} />
      <label className={styles.rotulo} htmlFor={`${id}-tipo`}>
        Tipo
      </label>
      <select id={`${id}-tipo`} className={styles.campo} value={t.tipo} onChange={(e) => setT({ ...t, tipo: e.target.value as TipoDeTermo })}>
        {TIPOS_DE_TERMO.map((tipo) => (
          <option key={tipo} value={tipo}>
            {ROTULO_TIPO_DE_TERMO[tipo]}
          </option>
        ))}
      </select>
      <label className={styles.rotulo} htmlFor={`${id}-significado`}>
        Significado (opcional)
      </label>
      <input id={`${id}-significado`} className={styles.campo} value={t.significado ?? ''} onChange={(e) => setT({ ...t, significado: e.target.value })} />
      {erro && <p className={styles.erroCampo}>{erro}</p>}
      <div className={styles.acoes}>
        <button type="button" className={styles.botao} disabled={JSON.stringify(t) === JSON.stringify(inicial)} onClick={enviar}>
          {rotulo}
        </button>
        {aoCancelar && (
          <button type="button" className={styles.botaoSecundario} onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

/** Um termo do glossário: a Sênior corrige ou tira; o antes e o depois ficam no histórico da configuração. */
function LinhaDoTermo({ t, podeEditar, salvar }: { t: Termo; podeEditar: boolean; salvar: Salvar }) {
  const [corrigindo, setCorrigindo] = useState(false)
  const caminho = `/configuracao/glossario/${t.id}`
  if (corrigindo)
    return (
      <li>
        <FormularioDoTermo
          inicial={{ termo: t.termo, tipo: t.tipo, significado: t.significado ?? '' }}
          rotulo="Salvar a correção"
          aoSalvar={(novo) => salvar(caminho, novo, 'Termo corrigido.')}
          aoCancelar={() => setCorrigindo(false)}
        />
      </li>
    )
  return (
    <li>
      {t.termo}
      {t.significado && ` · ${t.significado}`}
      {podeEditar && (
        <>
          {' '}
          <button type="button" className={styles.botaoSecundario} aria-label={`Corrigir ${t.termo}`} onClick={() => setCorrigindo(true)}>
            Corrigir
          </button>{' '}
          <button
            type="button"
            className={styles.botaoSecundario}
            aria-label={`Tirar ${t.termo}`}
            onClick={() => salvar(caminho, undefined, 'Termo tirado do glossário.', 'DELETE')}
          >
            Tirar
          </button>
        </>
      )}
    </li>
  )
}

/**
 * Glossário do escritório (GGVP-143): benefícios, siglas, peritos, juízos e varas que a transcrição e a IA usam.
 * A gestão vê; só a Sênior acrescenta, corrige e tira (o servidor decide `podeEditar`).
 */
function Glossario({ versao, salvar, aoErro }: { versao: number; salvar: Salvar; aoErro: (erro: string) => void }) {
  const [g, setG] = useState<GlossarioDoEscritorio | null>(null)
  useEffect(() => {
    void chamarApi<GlossarioDoEscritorio>('/configuracao/glossario').then((r) => (r.ok ? setG(r.dados) : aoErro(r.erro)))
  }, [versao, aoErro])
  if (!g) return null
  return (
    <section className={styles.cartao} aria-label="Glossário do escritório">
      <h2 className={styles.cartaoTitulo}>Glossário do escritório</h2>
      <p className={styles.dica}>
        Benefícios, siglas, peritos, juízos e varas, escritos como o escritório escreve. A transcrição e a IA usam esta lista.
        {!g.podeEditar && ' Quem muda é a Sênior.'}
      </p>
      {TIPOS_DE_TERMO.map((tipo) => {
        const termos = g.termos.filter((t) => t.tipo === tipo)
        if (termos.length === 0) return null
        return (
          <div key={tipo}>
            <p className={styles.rotulo}>{ROTULO_TIPO_DE_TERMO[tipo]}</p>
            <ul className={styles.lista} aria-label={`Glossário: ${ROTULO_TIPO_DE_TERMO[tipo]}`}>
              {termos.map((t) => (
                <LinhaDoTermo key={`${t.id}-${versao}`} t={t} podeEditar={g.podeEditar} salvar={salvar} />
              ))}
            </ul>
          </div>
        )
      })}
      {g.podeEditar && (
        <FormularioDoTermo
          key={`novo-${versao}`}
          inicial={TERMO_VAZIO}
          rotulo="Acrescentar ao glossário"
          aoSalvar={(t) => salvar('/configuracao/glossario', t, 'Termo acrescentado ao glossário.', 'POST')}
        />
      )}
    </section>
  )
}

/**
 * Configuração do escritório (GGVP-104): limites dos laços, kits por benefício e mensagens padrão, numa tela só.
 * A gestão vê; o Sócio e a Sênior mudam. Toda mudança vai para o histórico, que aparece no fim da tela (CA3).
 * O glossário do escritório (GGVP-143) é uma seção a mais, que só a Sênior muda.
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

  async function salvar(caminho: string, corpo: unknown, aviso: string, metodo = 'PUT') {
    const r = await chamarApi(caminho, { method: metodo, corpo })
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

          <Glossario versao={versao} salvar={(caminho, corpo, aviso, metodo) => void salvar(caminho, corpo, aviso, metodo)} aoErro={setErro} />

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
    </main>
  )
}

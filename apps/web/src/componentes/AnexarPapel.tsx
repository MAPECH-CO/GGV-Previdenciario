import { useId, useRef, useState } from 'react'
import { anexarPapel } from '../dados/anexoEmPapel.ts'
import { doServidor } from '../dados/servidor.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import styles from '../paginas/Balcao.module.css'

/** O papel digitalizado sobe para o servidor; `aoGuardar` avisa a tela que o arquivo entrou (o contrato recarrega a assinatura). */
export function AnexarPapel({ fichaId, processoId, tipo, aoGuardar }: { fichaId: string; processoId?: string; tipo: 'contrato' | 'ficha-atendimento'; aoGuardar?: () => Promise<void> | void }) {
  const id = useId()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const travado = useRef(false)
  const problema = arquivo ? problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size }) : ''
  async function enviar() {
    if (!arquivo || problema || travado.current) return
    travado.current = true
    setEnviando(true)
    setErro('')
    setAviso('')
    let guardou = false
    try {
      await anexarPapel(fichaId, arquivo, tipo, processoId)
      guardou = true
      setAviso('Arquivo guardado no servidor.')
      setArquivo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O arquivo não foi guardado. Tente novamente.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
    if (guardou) await aoGuardar?.()
  }
  return <div>
    <p className={styles.nota}>Digitalize no aplicativo do scanner ou tire uma foto. Selecione o PDF, JPG ou PNG (até 20 MB).</p>
    <label htmlFor={id}>{tipo === 'contrato' ? 'PDF ou foto do contrato assinado' : 'PDF ou foto da ficha em papel'}</label>
    <input id={id} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={enviando || !doServidor(fichaId)}
      onChange={e => { setArquivo(e.target.files?.[0] ?? null); setAviso(''); setErro('') }} />
    <button type="button" className={styles.atalho} disabled={!arquivo || !!problema || enviando} onClick={enviar}>
      {enviando ? 'Guardando arquivo…' : 'Guardar arquivo'}
    </button>
    {(erro || problema) && <p role="alert">{erro || problema}</p>}
    {aviso && <p role="status">{aviso}</p>}
    {!doServidor(fichaId) && <p>Envio indisponível nesta ficha de exemplo.</p>}
    <p className={styles.nota}>{tipo === 'contrato'
      ? 'O arquivo vai para a pasta do cliente, ligado à assinatura; depois, «Concluir a assinatura».'
      : 'O preenchimento automático a partir deste arquivo ainda não está disponível. Confira o papel e preencha os campos.'}</p>
  </div>
}

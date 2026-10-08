// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela.
// Sem DATABASE_URL, usa o banco embutido na memória, com usuários de exemplo (src/banco/exemplo.ts).
import { fileURLToPath } from 'node:url'
import { abrirArmazenamento } from './armazenamento.ts'
import { abrirBanco } from './banco/conexao.ts'
import { abrirDrive } from './drive.ts'
import { criarServidor } from './servidor.ts'
import { fontesAtivas } from './vigilia/fontes.ts'
import { ligarRelogio } from './vigilia/rodadas.ts'
import { sincronizarDrive } from './fluxo/arquivar.ts'
import { apagarSenhasVencidas } from './fluxo/cofre.ts'

const { banco } = await abrirBanco()

const app = criarServidor({
  logger: true,
  banco,
  pastaTela: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  cookieSeguro: process.env.NODE_ENV === 'production',
})
// Vigília do diário: 3 rodadas por dia (GGVP-30, G13). Uma batida por minuto, só aqui (nunca nos testes).
ligarRelogio(banco, fontesAtivas())
// Cofre do gov.br (GGVP-103 CA10): uma vez por dia, sai a senha de quem tem os casos encerrados há mais de 1 ano.
const limparCofre = () => void apagarSenhasVencidas(banco, new Date())
limparCofre()
setInterval(limparCofre, 24 * 3_600_000)
// Drive do escritório (GGVP-107): com as variáveis, o que falta vai para o Drive ao subir e a cada minuto, uma rodada por vez.
const comDrive = abrirDrive()
if (comDrive) {
  const arquivos = abrirArmazenamento()
  let rodando = false
  const enviarAoDrive = async () => {
    if (rodando) return
    rodando = true
    try {
      const r = await sincronizarDrive(banco, comDrive.drive, comDrive.pastas, arquivos)
      if (r.enviados || r.falhas.length) app.log.info({ drive: r }, 'rodada do Drive')
    } catch (e) {
      app.log.error(e, 'rodada do Drive')
    } finally {
      rodando = false
    }
  }
  void enviarAoDrive()
  setInterval(() => void enviarAoDrive(), 60_000)
}
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })

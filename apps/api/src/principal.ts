// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela.
// Sem DATABASE_URL, usa o banco embutido na memória, com usuários de exemplo (src/banco/exemplo.ts).
import { fileURLToPath } from 'node:url'
import { abrirArmazenamento } from './armazenamento.ts'
import { abrirBanco } from './banco/conexao.ts'
import { abrirDrive, conferirDrive } from './drive.ts'
import { criarServidor } from './servidor.ts'
import { fontesAtivas } from './vigilia/fontes.ts'
import { ligarRelogio } from './vigilia/rodadas.ts'
import { sincronizarDrive } from './fluxo/arquivar.ts'
import { apagarSenhasVencidas } from './fluxo/cofre.ts'
import { carregarFeriadosSeVazio } from './fluxo/feriados-ao-subir.ts'

const { banco } = await abrirBanco()
// P17: com banco de verdade, os feriados da lei de 2026 e 2027 entram na primeira subida (tabela vazia). No banco de
// exemplo (testes de tela), não: lá a lista vazia é o ponto de partida dos testes do prazo e do botão "carregar".
if (process.env.DATABASE_URL) await carregarFeriadosSeVazio(banco, new Date())

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
if (comDrive?.soLeitura) {
  // CA10: na homologação, só a leitura; nada vai para o Drive real do escritório.
  void conferirDrive(comDrive.drive, comDrive.pastas).then((r) =>
    r.ok ? app.log.info({ drive: r }, 'Drive lido (só leitura)') : app.log.error({ drive: r }, 'Drive não leu'),
  )
} else if (comDrive) {
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
  // CA9: uma leitura ao subir, para a homologação mostrar no log que o Drive está ligado e lendo (só contagens).
  void conferirDrive(comDrive.drive, comDrive.pastas).then((r) =>
    r.ok ? app.log.info({ drive: r }, 'Drive lido') : app.log.error({ drive: r }, 'Drive não leu'),
  )
} else app.log.info('Drive desligado: faltam as variáveis GOOGLE_DRIVE_*')
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })
// Sugestão pronta (Mateus, 07/10): a IA prepara em segundo plano a sugestão de cada tarefa aberta; ao subir e a cada 5 min.
// Na mesma batida, depois das sugestões, o acervo se alimenta sozinho (GGVP-141, ADR-013).
const prepararSugestoes = () => void app.prepararSugestoes().then(() => app.alimentarAcervo())
prepararSugestoes()
setInterval(prepararSugestoes, 5 * 60_000)

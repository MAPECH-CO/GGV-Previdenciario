# Protótipo navegável no Figma

Arquivo **"Portal GGV Previdenciário"** (chave `nHOPzl005CpWDXUWyVZIo6`), na conta MAPECH. É a simulação
clicável do desktop, revisada com o PO em 28/09/2026. O modelo de tela vale para o Railway depois.

## Princípio: por trabalho, não por cliente
A pessoa **não navega por cliente**. Ela entra na **Central de trabalho** da função dela, vê
"O que você tem que fazer" (notificações com o código do passo do BPMN, o cliente, o benefício e o
prazo) ou **busca** por processo, nome ou tarefa. Cada item abre a **tela daquele trabalho** e
"Voltar à Central" retorna. Não existe tela de cliente dedicada.

## Páginas do arquivo
| Página | O que tem | Início do fluxo (Present) |
|---|---|---|
| Desktop · Central de trabalho (simulação) | Uma Central **por função** (Atendimento, Documentação · ADM, Advogada, Sênior, Estagiário/assistente, Financeiro) e 46 telas de ação `step_<código>` | Cada Central é um ponto de início |
| Desktop · Advogada (workspace) | Meus processos → Processo (uma página só) → Minuta (tela própria); variante pós-sentença; variantes tema escuro e fonte grande | Advogada · Meus processos |
| Desktop · Jurídico (simulação) | Versão anterior (hub do caso). Referência, não é o modelo atual | — |
| Page 1 | Homes por perfil e mobile da primeira rodada. Referência | — |

O seletor de perfil (canto superior direito da Central) abre "Entrar como…" e troca de Central. As
notificações de cada função vêm de `docs/requisitos/funcoes-e-telas.md`.

## Advogada: o que foi decidido
- **Meus processos**: cada cartão mostra a etapa (balão), o próximo passo e o prazo. À direita, as
  últimas movimentações dos processos do setor.
- **Processo em uma página só**: resumo da IA sobre o estado do processo + próxima ação (botão),
  movimentações, exigências (com prazo, responsável e prova, G21), perícia, documentos (abrir cada
  um). Tudo já preenchido com sugestão da IA; a advogada confere e ajusta.
- **Histórico**: aba recolhida logo abaixo do número do processo, marcada "histórico". Abre a linha
  do tempo dos últimos ocorridos (quem fez, quando, do mais recente ao mais antigo).
- **Etapas futuras não aparecem**: julgamento, recurso, prestação de contas e honorários só entram
  na página quando o processo chega nelas. O protótipo mostra o caso "em exigência, sem sentença"
  (sem honorários) e a variante **pós-sentença** (com prestação de contas e honorários sugeridos
  pela IA, aviso ao cliente só após o OK, G8).
- **Minuta em tela própria**: últimas publicações do processo (contexto da IA), tipo de peça (só
  o que cabe na etapa), caixa de instruções para a IA já preenchida, checkboxes (Tema 350, laudo,
  precedentes do acervo, tutela, anexos) e as travas antes de protocolar (G7). A IA gera; a
  advogada assina (G6).

## Atendimento: o que cada tela de ação carrega
Tipo de benefício sempre visível; contatos do cliente (ligar/WhatsApp) em toda tela que pode
precisar de contato; anexo do documento faltante; contrato na íntegra + anexar página de
assinatura; lista de exigências com cumprida/pendente/sem prova; resumo do que foi coletado com
abrir cada documento; links para os documentos do scanner; campos do lead.

## Suporte interno em todas as telas
Aba "✦ Suporte" na borda direita de **todos** os artboards do desktop. Abre uma janela à direita com
o chatbot do escritório (Chatwoot embutido, ver `docs/arquitetura/chatwoot-no-portal.md`). O chat
herda o perfil de quem está logado e não contorna portão (GGVP-82); um humano entra se precisar.

## Cor, tema escuro e fonte maior
- Paleta: acento **laranja escuro** `#B4531A`, tinta suave `#FBEADB`; fundo `#F6F7F8`, texto
  `#15171C`, texto suave `#616875`, linha `#E4E7EB`. Perfis: Advogada azul, Sênior roxo,
  Financeiro âmbar. As cores de **status** (verde "Cumprida", âmbar "Pendente", vermelho urgente)
  foram mantidas para não perder o significado. **A confirmar com o PO** se os status também
  devem virar laranja.
- **Variáveis do Figma**: coleção `Tema` (modos Claro/Escuro) com 29 cores e coleção
  `Acessibilidade` (modos Padrão/Fonte grande, +25%) com 17 tamanhos. Toda cor e todo tamanho de
  fonte do arquivo estão ligados a elas; trocar o modo de um frame troca a tela inteira.
- No protótipo, os botões "☾ Escuro / ☀ Claro" e "A+ / A−" (Central da Advogada e página do
  processo) navegam entre as variantes. No portal real, é a preferência do usuário.

## Como apresentar
1. Abrir a página, Present (▶). Na Central: clicar em uma notificação, ou na busca, e voltar.
2. Trocar de função pelo seletor. Abrir o Suporte pela aba da direita.
3. Na página da Advogada: abrir um processo, o histórico, a próxima ação e a minuta; testar
   ☾ e A+.

## Limitações do protótipo
- Overlays (histórico, seletor, chat) usam uma moldura transparente do tamanho da tela, porque a
  API do Figma não permite posicionar overlay por código.
- O mobile (versão do atendente) ainda está na primeira rodada, sem estas revisões.
- "Jurídico (simulação)" e "Page 1" ficaram como referência da rodada anterior.

## Próximos passos
Validar com o PO as 7 Centrais e as telas do Jurídico; aplicar o mesmo nível de detalhe do
Atendimento nas telas de Sênior, Estagiário e Financeiro; atualizar o mobile; depois Railway.

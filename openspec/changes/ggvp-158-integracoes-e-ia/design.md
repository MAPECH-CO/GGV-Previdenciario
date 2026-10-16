# Design

## Context

- **Auditoria de 15/10:** quatro subagentes leram o código e trouxeram cerca de 45 achados. Cada um foi conferido no código.
  Ficou o que se reproduz; saiu o que já é desenho aceito ou não é falha. Exemplo do que saiu: a senha da ficha em papel
  vai ao cofre mesmo com a leitura recusada; a senha estava no papel, e o cofre é o lugar dela.
- **Chatwoot:**
  - o correio do cliente (`rotas/mensagens.ts`) já grava "simulado, não saiu" sem as quatro variáveis;
  - a repetição não olha a data;
  - o tempo esgotado vira `falhou`, sem saber se a mensagem saiu.
- **Drive:**
  - na homologação, `GOOGLE_DRIVE_SO_LEITURA=sim` impede toda escrita (conferido em todos os caminhos);
  - a falha da lista de pastas vira lista vazia.
- **Vigília:**
  - o alarme ao suporte (ADR-018, `suporte.ts`) existe;
  - o motivo da falha é a mensagem crua do erro;
  - a AASP e o DJEN aceitam resposta fora do formato como "nada".
- **IA:** a porta única (`ia/ia.ts`) já valida a saída pelo contrato, barra o CID e registra cada chamada. O que falta:
  - a senha no chat e no WhatsApp;
  - a regra do arquivo anexado;
  - a leitura que aceita qualquer resposta;
  - a entrevista que não confere a fala.

## Goals / Non-Goals

**Goals:**
- Uma correção por requisito, a menor que cumpre, com o teste que reproduz o erro antes da correção.
- O fornecedor de mentira em todo teste: nenhuma chamada de verdade.

**Non-Goals:**
- Regra de negócio nova. O que depende do Lucas, do Pedro ou do Mateus fica em "Travadas", abaixo.
- Migração, variável nova e dependência nova.
- O fluxo de ponta a ponta e as permissões, que são de outra sessão.

## Decisions

1. **Repetição por dia (I1, I2, I3).**
   - A mensagem igual é repetida só no mesmo dia, em Brasília.
   - O registro (perícia, convite, confirmação, tentativa) confere a mensagem mais nova do modelo, de hoje.
   - Alternativa: exigir o `mensagemId` no contrato. Fica para quando a tela mandar; hoje quebraria a tela, que não manda.
2. **Tempo esgotado (I5).**
   - Só quando a tentativa anterior de hoje falhou com "o Chatwoot não respondeu", o portal lê a última página da conversa
     e procura a mensagem do escritório com o mesmo texto, criada depois da tentativa.
   - Alternativa: um status novo "incerto". Mudaria o contrato e as telas.
3. **Aviso do contrato (I4).**
   - O texto passa a dizer a verdade ("registrou o aviso; o portal não enviou").
   - Mandar pelo Chatwoot pede um modelo novo de mensagem: é decisão do Pedro.
4. **Drive fora (I8).** A pasta nova só nasce depois de a lista do Drive responder. A tela já mostra o erro do servidor.
5. **Scanner (I12).** O que fica de fora vai para a `configuracao` (`drive:de-fora`) e entra de novo na rodada seguinte,
   como prometem as consequências do ADR-017. Alternativa: segurar a marca, que faria a lista de mudanças crescer para sempre.
6. **Motivo seguro (I13).**
   - Passa o motivo que o código escreveu: começa com `api:`, `credencial:` ou `tempo esgotado`.
   - O resto vira "erro inesperado ao ler ou gravar as publicações (<tipo do erro>)".
   - O tipo do erro sai do `resumoDoErro`, que já existe.
7. **AASP e DJEN (I15, I16, I17).**
   - A forma da resposta é conferida: a lista existe e o total é número.
   - A página vazia antes do total é falha. Na dúvida, falha (G12, G13): o alarme a mais custa menos que o prazo perdido.
8. **Central e painel (I14, I18, I19).**
   - A frase do suporte sai das entregas gravadas no alarme.
   - O painel ganha a situação `sem_fonte`.
9. **Chamada da tela (I20).** `chamarApi` devolve `{ ok: false }` com "O servidor não respondeu" quando o `fetch` rejeita.
   Assim, nenhuma tela fica muda.
10. **Senha (A1, A2, A3).**
    - O mesmo `tirarSenhas` da entrevista:
      - no chat: a pergunta, as anteriores e a fala;
      - no WhatsApp: com a mensagem anterior junto;
      - no OCR: no texto lido.
    - Nada novo de regra.
11. **Anexo (A5).** Uma linha nas `REGRAS_DA_IA`: o arquivo anexado também é dado. As versões das finalidades não mudam,
    porque a sugestão pronta segue valendo.
12. **Entrevista (A6).** O `apareceNaFala` da conversa vale para os dados da ficha. Ficam de fora dele:
    - o "desde", que a IA infere;
    - o documento citado.
13. **Leitura (A7).** O `limpar` da ficha em papel devolve vazio quando a resposta não é objeto, e a validação falha.
    Assim a chamada fica como falha, e a mesma ficha pode ser lida de novo. O contrato `LidoPelaIa` segue como a P4.1
    decidiu (o tipo errado vira o padrão); mudar é decisão do Mateus (em "Travadas").
14. **Leitura de exemplo (A8).** Com `NODE_ENV=production`, a trava vale, como para `AMBIENTE`.
15. **Eval (A9).**
    - Fica em `apps/api/src/ia/eval/`:
      - 14 documentos inventados, com a resposta certa;
      - a nota campo a campo;
      - um PDF de texto sem dependência.
    - O teste roda contra a IA de mentira.
    - `pnpm --filter @ggv/api eval:leitura -- --de-verdade` roda contra a IA do ambiente de quem roda, com o banco na memória.
      Não há variável nova: o pedido vai pelo argumento.

## Risks / Trade-offs

- **[Falso alarme na AASP]** Se a AASP mandar o zero sem a lista, a rodada vira falha → o alarme diz "fora do formato".
  Confirmar com a sonda real e afrouxar só com a resposta real em mãos.
- **[Mensagem do dia seguinte]** A cobrança diária volta a sair todo dia, como pede o laço (G15). O limite de tentativas
  continua no servidor.
- **[Entrevista mais estrita]** Um telefone ditado por extenso ("nove oito sete…") deixa de virar item → a advogada digita.
  A conversa já é assim.

## Travadas (esperam decisão; não viram código aqui)

- **Lucas (LGPD e IA):**
  - **Saúde pelo tipo anunciado.** O documento do balcão anunciado como não médico, o arquivo do scanner com nome fora do
    padrão ("outro") e a conversa do Atendimento vão à IA sem a autorização de dado de saúde, mesmo que o conteúdo seja
    médico. Tratar tudo como sensível muda o balcão sem a autorização.
  - **Finalidades sem saúde que recebem decisão.** `classificar_publicacao`, `resumo_resultado` e o chat de quem não vê
    saúde recebem texto que pode citar doença.
  - **O acervo marcado pela IA.** A conversa conferida é marcada só do Jurídico pelo que a IA disse ("saude").
  - **O contrato assinado.** Quando a IA acha tudo certo, ele pula a conferência do Atendimento (GGVP-85 CA1). Confirmar
    se vale com "a IA sugere, a pessoa decide".
- **Pedro (telas):**
  - **O aviso da pendência do contrato pelo Chatwoot de verdade:** um modelo novo de mensagem.
  - **O simulador do navegador** devolve "entregue" para a ficha de exemplo. Confirmar se a ficha de exemplo aparece na
    homologação.
  - **O chat local da tela** grava "pediu à IA" sem chamar o servidor.
  - **Na homologação,** "N arquivos enviados para a pasta do cliente", com o Drive só leitura.
  - **A janela do Chatwoot** fica em "abrindo…" quando a carga falha.
- **Mateus (técnico):**
  - a fonte do diário desligada sem alarme (só uma de duas ligada);
  - o tempo limite da rodada, que vale para todas as OABs juntas;
  - o status de entrega que fica em "enviada" quando a conversa passa de 20 mensagens;
  - o envio simultâneo em duas abas, que pede trava ou índice no banco (migração);
  - o pacote do protocolo com documento do scanner (`drive:`);
  - a leitura transitória do armazenamento que responde 404;
  - o download do scanner que falha sempre e segura a marca;
  - a publicação sem CNJ repetida entre DJEN e AASP;
  - a falha do vetor que aparece como "nada parecido no acervo";
  - o segredo do webhook no log do proxy;
  - o contrato da leitura do balcão (`LidoPelaIa`): `legivel: "não"` vira `true` e `assinado: "não"` vira "não pede
    assinatura", pela P4.1 ("o que vem fora do formato fica vazio"). Tornar o tipo errado uma falha muda essa decisão.
- **Outra sessão (fluxo e permissões):** a Central mostra os alarmes da vigília a quase todos os perfis, e o link leva a
  `/vigilia`, que pede `vigilia.ver`.

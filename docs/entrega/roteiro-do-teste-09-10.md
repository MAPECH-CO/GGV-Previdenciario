# Roteiro do teste de aceite de 09/10 (GGVP-144)

<!-- AVISO DA COBRANÇA: apagar daqui até o fim do aviso quando a homologação receber o #28, o #17 e o #43. -->
> **Aviso de 09/10: o que está na homologação agora**
>
> Desde as 07:03 de hoje, o GitHub Actions da MAPECH-CO está parado por cobrança. Por isso, nada novo sobe para a
> homologação (ggvprev.mapech.com.br).
>
> - **Já está na homologação:** tudo até o pedido #23 (levar ao banco). Isso inclui a transcrição de verdade (#13), a
>   entrevista direta e o topo (#14), o fuso de Brasília (#15), o desfecho e o Financeiro (#5), a Recepção e a Abertura
>   no servidor (#2), o Chatwoot no servidor (#19), a página do processo pelo banco (#21) e o caso devolvido, as tarefas
>   do setor e a Documentação na Central do Atendimento (#20).
> - **Está na `main`, mas ainda não subiu:** a trava do Chatwoot e os modelos de complemento e de resultado (#28), e a
>   saúde simples na Perícia (#17). Sobem sozinhos quando a cobrança for acertada. Os passos que dependem deles dizem
>   "depois que o #28 subir" ou "depois que o #17 subir".
> - **Cuidado com o Chatwoot até o #28 subir.** Sem a trava, se o Chatwoot de verdade estiver ligado na homologação, a
>   mensagem sai no WhatsApp do telefone da ficha. Antes de enviar, olhe a janela: se ela **não** diz "simulado", pare e
>   chame o Mateus.
> - **O #43 está pronto e sobe quando a cobrança for acertada.** Ele junta quatro pedidos já revisados: o acesso por
>   perfil (#25), a Perícia de verdade no servidor (#30), a IA que lê a entrevista (#37) e as telas do Figma (#42). Ainda
>   não está na `main`: entra depois que a verificação do GitHub passar, e então sobe sozinho. Os passos que dependem dele
>   dizem "(depois que o #43 subir)". Antes disso, siga o passo como está.
<!-- FIM DO AVISO DA COBRANÇA -->

Para o Lucas testar a homologação em 09/10/2026, de manhã até o fim do dia. Segue o caminho do escritório: do balcão ao
contrato, à documentação médica, ao INSS, à perícia, à Justiça e ao desfecho. Cada passo diz o que fazer, o que deve
aparecer e a história do Jira que ele prova.

O roteiro foi percorrido de verdade em 08/10, no portal local (`pnpm dev`, com a semente de exemplo), pelo navegador
automático, entrando com os usuários de exemplo e trocando de perfil como o Lucas vai fazer. O que não funcionou está na
seção "Problemas já encontrados". Depois da última mescla da `main` (Recepção ligada no servidor, GGVP-125, e Desfecho e
financeiro, GGVP-11), as jornadas da Recepção e do desfecho foram percorridas de novo.

**Atualizado em 09/10, de madrugada,** com o que entrou na `main` depois da versão anterior: na noite de 08/10, o
Relacionamento, a documentação médica e a Perícia no servidor, a navegação por perfil e os feriados; na madrugada de 09/10,
os pedidos #13, #14, #15, #5, #2, #19, #21, #20, #23, #28 e #17. Esta atualização foi conferida no código e nos testes da
`main`, sem nova passada no navegador. As jornadas que mudaram dizem "Conferida em 09/10".

**Atualizado de novo em 09/10, de manhã,** com o que entra com o pedido #43, ainda fora da `main`. Os passos novos ou
ajustados dizem "(depois que o #43 subir)". Foram conferidos no código e nos testes da branch do #43, sem passada no
navegador (seção 7).

## Sumário

1. Antes de começar: usuários, como entrar, o que é simulado, cuidados, o que é dado de saúde e o que muda com o #43
2. Como registrar um problema no Jira
3. Plano de volta: voltar à versão anterior e quem chamar
4. Problemas já encontrados (os mais graves primeiro)
5. Ordem sugerida do dia
6. Jornadas por perfil: Atendimento, líder do Atendimento, Documentação, Advogada, Sênior, Jurídico administrativo,
   Financeiro e Sócio
7. Como foi conferido em 08/10 e em 09/10

---

## 1. Antes de começar

### Usuários de teste

Só e-mail e perfil. As senhas provisórias chegam pelo Mateus, por fora do repositório, do Jira e do chat. No primeiro
acesso, cada usuário pede para trocar a senha (GGVP-117); troque e guarde a nova.

| E-mail | Perfil | Para que serve no teste |
|---|---|---|
| atendimento@exemplo.ggv | Atendimento | balcão, agenda, contrato, cobrança, relacionamento |
| lider@exemplo.ggv | Atendimento · líder e Atendimento | trocar de perfil, tarefas do setor (escolher quem faz), a Gestão no topo; depois que o #43 subir, Clientes e Processos no topo |
| documentacao@exemplo.ggv | Documentação | receber e conferir documentos, checklist, liberar, exigências; usa a Central do Atendimento, só com as tarefas dela |
| advogada@exemplo.ggv | Advogada responsável | entrevista, parecer médico, INSS, petição, perícia |
| senior@exemplo.ggv | Sênior | conferência antes do INSS, despacho, vigília, gestão, tarefas do setor do Jurídico, feriados |
| senior2@exemplo.ggv | Sênior (a segunda) | aprovar a dispensa do parecer, que pede duas sêniores |
| juridico@exemplo.ggv | Jurídico administrativo | protocolo no Meu INSS, perícia |
| financeiro@exemplo.ggv | Financeiro | receber a prestação de contas, totais em dinheiro; depois que o #43 subir, o painel Financeiro |
| socio@exemplo.ggv | Sócio | resultados do escritório, configuração; depois que o #43 subir, ler a ficha e o caso e ver o painel Financeiro |
| provisoria@exemplo.ggv | Atendimento | testar a troca obrigatória da senha |
| semperfil@exemplo.ggv | nenhum | testar o aviso "sem perfil" |
| trava@exemplo.ggv | Atendimento | testar a trava depois de 5 senhas erradas |

### Como entrar e trocar de perfil

- Entre pelo endereço da homologação (o Mateus manda junto com as senhas). A tela pede e-mail e senha.
- Para trocar de perfil: botão **Sair**, no topo, e entre com o próximo e-mail. **Faça isso na mesma aba do
  navegador.** Algumas telas ainda guardam o que você fez na própria aba (ver "O que ainda é simulado"); aba nova ou
  janela nova começa do zero nessas telas. Depois que o #43 subir, continua igual: "Sair" e "Entrar como…" não apagam o
  que a aba guardou, de propósito, para o roteiro seguir o caso de uma pessoa a outra.
- O líder tem dois perfis: o nome do perfil no topo ("Atendimento · líder ⌄") abre "Entrar como…" e troca a Central
  sem sair.
- **Cada tela confere o perfil.** Quem abre a tela de outro perfil (por um link copiado, por exemplo) vê "Sem
  permissão", e a tela nem abre. Isso é o esperado; não registre como Bug.
- **A Documentação usa a Central do Atendimento**, mas vê só as tarefas dela: documento do balcão, conferir documento,
  checklist, liberar ao Jurídico, exigências e documentos da perícia. A cobrança, o contrato e o caso devolvido ficam com
  o Atendimento.

### O que ainda é simulado (vale para o dia todo)

Em linguagem simples, antes de cada jornada o roteiro repete o que vale para ela:

- **A IA.** Nos casos do servidor, a IA da documentação médica, da Perícia, do Relacionamento, do indeferimento, da
  petição e do resumo do resultado é de verdade **se a chave da IA estiver ligada na homologação** (confirme com o
  Mateus). Sem a chave, a tela avisa e a pessoa preenche. Nas pessoas de exemplo do navegador (lista abaixo), a IA é de
  mentira: textos prontos, sempre iguais. A sugestão de benefício e o resumo da entrevista também são de exemplo: a IA
  na entrevista vem num pedido aberto. Depois que o #43 subir, no lead do servidor a IA lê a entrevista transcrita e
  sugere o resumo e os dados da ficha, cada um com o trecho de onde saiu; a advogada confirma ou corrige (AD1).
- **A transcrição.** É de verdade com a chave da IA (GGVP-133). Sem a chave, e nas pessoas do navegador, o texto é
  sempre o mesmo diálogo de exemplo, mesmo quando não combina com o cliente. Depois que o #43 subir, nos clientes do
  servidor não há mais diálogo de exemplo: sem a chave, a tela diz "A transcrição falhou: …" com o motivo, e o áudio
  fica guardado. Sem microfone, a tela avisa "Sem microfone: …" e não inventa falas. As pessoas do navegador continuam
  com o diálogo de exemplo.
- **O Chatwoot.** Nos clientes do servidor, a mensagem passa pelo servidor: "Mensagem ao cliente", convite, confirmação,
  cobrança, complemento, perícia e o aviso de mudança dos dados bancários. Ela só sai de verdade se o Mateus ligou o
  Chatwoot na homologação; senão, a janela diz "simulado" e nada sai. Nas pessoas do navegador, sempre simulado. O link
  do ZapSign pelo WhatsApp e as boas-vindas do checklist continuam simulados para todos.
  Depois que o #28 subir, fora de produção a mensagem só sai para os telefones da lista de teste; para os outros, a
  janela avisa antes e o envio fica como "não saiu". Até lá, veja o aviso no topo.
- **O ZapSign é de mentira.** O link de assinatura é de exemplo; o retorno "assinado" vem do botão "Simular o retorno do
  ZapSign".
- **Scanner e impressora são de mentira.** "Digitalizar (scanner simulado)" e "Imprimir" só fingem.
- **As fontes do diário (AASP e DJEN) são de exemplo.** As de verdade vêm no pedido #1.
- **Algumas telas ainda guardam no navegador, não no servidor.** É o caso das pessoas de exemplo do navegador (Josefa,
  Natália, Antônio, Cleide, Nair, Rita, Marta, Sebastião Exemplo, Pedro Exemplo, Maria Exemplo, Lúcia Exemplo, Davi): o
  que você faz com elas fica só nessa aba; outra pessoa, em outro computador, não vê. Elas não têm conversa, mensagem ao
  cliente nem dados bancários: isso agora é só para cliente do servidor. Também ficam no navegador, mesmo para o cliente
  do servidor, os documentos, o checklist, a cobrança, as boas-vindas e a primeira liberação ao Jurídico (vêm no pedido
  #22 e no seguinte).
- **O que já grava no servidor:** o lead novo do balcão, do cadastro à cópia do contrato assinado (agenda, entrevista,
  benefício, cálculo, fechamento, segunda ficha, contrato, assinatura, leitura e cópia); a documentação médica, a
  Perícia e o Relacionamento dos clientes do servidor; o caso devolvido pela Sênior; as tarefas do setor; toda a via
  administrativa no INSS; a Justiça; o desfecho (prestação de contas, ida ao banco e quem leva, resultado explicado); o
  cofre do gov.br; a gestão, os feriados e os resultados; a página do processo dos casos do servidor. Isso qualquer
  perfil vê, em qualquer computador.
- **Nomes misturados.** As telas do navegador chamam a advogada de "Dra. Paula" e a Documentação de "Jéssica"; os
  usuários de exemplo do servidor são "Gabi (exemplo)" e "Fábio (exemplo)". É a mesma pessoa de teste.
- **Duas Lúcias.** "Lúcia Exemplo" é do navegador; "Lúcia Prado (exemplo)" é do servidor (documentação médica). São
  pessoas diferentes.

### Cuidados com o relógio e com os casos de exemplo

- **A entrevista da Josefa é "hoje às 15:30".** Faça a jornada da Josefa antes das 15:30; depois desse horário a
  pendência "Preencher ficha" some, porque a hora da entrevista já passou.
- **As perícias de exemplo ficam 9 dias à frente.** Confirmar presença e registrar o comparecimento só liberam na
  véspera e depois da data; por isso o resultado da perícia não dá para testar em 09/10 (problema P7).
- **Cada caso de exemplo do servidor só passa uma vez.** O que você aprova, protocola ou decide fica gravado na
  homologação. Se precisar repetir, peça ao Mateus para recriar o banco da homologação (isso gera senhas novas).
- **O servidor conta o dia no fuso de Brasília** (#15). Antes, entre 21h e meia-noite o portal via o dia seguinte (por
  exemplo, o "Ligar" do complemento travava até a meia-noite). Algumas urgências de tarefas ainda contam o dia pelo
  relógio mundial: se algo mudar de cor ou de dia depois das 21h, registre.

### Dado de saúde: o que é e quem vê (regra do Pedro, 08/10)

- **Dado de saúde é só o conteúdo médico:** o laudo, o CID, o diagnóstico, o parecer médico e o texto dos documentos
  médicos. Só o Jurídico vê.
- **Status, datas e etapas não são dado de saúde:** documento recebido, laudo ok ou pendente, perícia marcada, feita,
  favorável ou não, e o que a própria pessoa registrou. O Atendimento e a Documentação veem normalmente (Lucas, 02/10).
  Isso não é problema; não registre como Bug.
- O portal não filtra frases ou palavras de saúde em texto livre, de propósito. Também não é problema.
- **Página do processo de um caso do servidor** (#21): fora do Jurídico, o documento médico aparece só como "existe",
  sem o nome nem o arquivo. Financeiro e Sócio não abrem o caso. Depois que o #43 subir, o Sócio abre e lê o caso, com os
  valores, sem o conteúdo médico e sem a petição; o Financeiro continua sem abrir.
- **Perícia, depois que o #17 subir:** fora do Jurídico, todos do caso veem o resultado (favorável ou não), a etapa, o
  histórico, as tentativas e a orientação. Só a leitura do laudo e os laudos do perfil do perito ficam com o Jurídico.
  Vale para as perícias do servidor.

### Depois que o #43 subir: o topo de cada perfil e o que ele não abre mais

O topo muda pelo perfil de quem entrou. Depois do "Início" e da "Agenda":

| Perfil | O que aparece no topo |
|---|---|
| Atendimento e Documentação | só a Agenda; sem Clientes nem Processos |
| Líder do Atendimento | Clientes, Processos e a Gestão (Tentativas bloqueadas, Prazos, Uso do cofre, Resultados, Configuração) |
| Advogada | Clientes e Processos, além do que já tinha |
| Sênior | Clientes, Processos, Estudos de caso, Roteiros de laudos, a Gestão e "Importar planilha"; sem "Financeiro" |
| Jurídico administrativo | igual a hoje |
| Financeiro | "Resultados" (o único item da Gestão) e "Financeiro" (o painel) |
| Sócio | a Gestão, "Importar planilha" e "Financeiro" (o painel) |

O que cada perfil não abre mais. Pelo link copiado, a tela mostra "Sem permissão" e não abre. É o esperado; não
registre como Bug. O passo a passo está em ENT, passos 8 a 11.

- **Financeiro:** Prazos, Tentativas bloqueadas, Uso do cofre, Configuração, Clientes e Processos. Fica com os
  Resultados e o painel Financeiro.
- **Documentação:** as telas que conduzem o contrato, como "Preparar contrato" (a assinatura abre só para ler), e a
  manifestação no processo. Na ficha, não vê mais o cartão "Dados bancários para o repasse".
- **Jurídico administrativo:** a Central da advogada, a entrevista e o cadastro do lead. Também não vê o cartão dos
  dados bancários. Continua vendo o dado de saúde da perícia.
- **Atendimento:** a manifestação no processo, que é peça jurídica.
- **Sênior:** o painel Financeiro.
- **Sócio:** passa a abrir, só para ler, a ficha do cliente (pela busca) e a página do processo, com os valores. Não vê
  o conteúdo médico, a petição nem os dados bancários, e não faz nenhum passo do caso.
- **A Sênior faz os passos jurídicos da advogada** (o servidor deixa): conferir o laudo, decidir a perícia, pedir,
  aprovar e protocolar a petição, tratar a exigência do INSS, distribuir e manifestar a exigência do juiz, entrevistar
  e analisar a ficha. Ficam só com a advogada: a decisão no limite e o resultado da perícia, e a prestação de contas.

### Publicação durante o teste

- **Nada entra na `main` durante o teste sem avisar.** Cada mescla na `main` publica sozinha na homologação em até 10
  minutos e pode trocar a tela no meio de uma jornada. Hoje a publicação está parada (aviso no topo); quando voltar, o #28
  e o #17 sobem juntos. O #43 entra na `main` só com a verificação do GitHub verde: combine a hora com o Lucas, porque
  ele muda o topo e as Centrais de vários perfis.

---

## 2. Como registrar um problema no Jira

Um cartão por problema, no projeto **GGVP**, tipo **Bug**:

1. **Título:** `[Perfil] Jornada e passo · o que aconteceu`. Exemplo: `[Jurídico administrativo] JA3 passo 2 · tarefa
   abre "tela ainda não construída"`.
2. **Descrição**, nesta ordem:
   - Perfil e e-mail com que entrou.
   - Jornada e número do passo deste roteiro (por exemplo, "AT4 passo 3").
   - O que esperava (copie o "resultado esperado" do passo).
   - O que aconteceu, com o texto da mensagem, se houve.
   - Data e hora.
3. **Print:** tire o print da tela inteira (no Windows, `Windows + Shift + S`) e cole direto no cartão. Se o problema
   envolve um passo antes, um print de cada passo.
4. **Ligue o cartão à história** que o passo prova (a chave GGVP-n está na última coluna do passo), como "relates to".
5. **Prioridade:** Highest se trava a jornada (não dá para seguir); High se dá para seguir com o resultado errado;
   Medium para texto, nome ou aparência.
6. **Responsável:** Pedro, se é tela; Mateus, se é servidor, login, banco ou a homologação fora do ar. Na dúvida, deixe
   sem responsável e marque os dois no comentário.
7. Se o problema impede seguir o roteiro, avise também no chat do time, com o link do cartão.

Antes de abrir, olhe a seção 4: se o problema já está lá, comente no cartão que existir (ou cite o número Pn) em vez de
abrir outro.

---

## 3. Plano de volta

### Quando acionar

- O portal não abre, mostra tela branca para todos os perfis, ou o login não funciona para ninguém.
- A homologação responde erro em todas as telas depois de uma publicação nova.
- Dado gravado sumiu ou apareceu para o perfil errado (por exemplo, valores ou conteúdo médico para o Atendimento).

### Quem chamar

| Problema | Quem | O que faz |
|---|---|---|
| Servidor, banco, login, homologação fora do ar, publicação que quebrou | **Mateus** | volta a versão, olha o log, recria o banco se precisar |
| Tela que quebrou, botão que não faz nada, texto errado | **Pedro** | corrige a tela ou orienta o caminho |
| Impedimento que para o teste | **Fernando** | junta quem precisa e remove o impedimento |
| Seguir ou parar o teste | **Lucas** | decide, com o que o Mateus e o Pedro disserem |

### Como voltar à versão anterior (Mateus)

1. **A publicação falhou sozinha:** se a migração do banco falha ou a saúde do portal (`/saude`) não responde, o Coolify
   não troca a versão e mantém a anterior no ar. Nada a fazer além de ler o log do deploy e avisar.
2. **A publicação subiu, mas quebrou o portal:** no Coolify, no app de homologação (`ggv-prev-homologacao`), abra a
   lista de deploys e volte ao último deploy que estava bom (Rollback, ou novo deploy daquele commit). Desde a noite de
   08/10 o Coolify roda a imagem que o GitHub publica a cada merge, com a tag de cada commit
   (`docs/infra/homologacao.md`): voltar é rodar a imagem com a tag do último commit bom. Confira
   `/saude` (deve responder `"banco":"ligado"`) e entre com um usuário de teste.
3. **Para deixar a `main` igual à versão boa:** abra um PR que reverte a mescla que quebrou
   (`git revert -m 1 <commit da mescla>`), com o outro dev revisando. Ao mesclar, a homologação publica de novo, sozinha.
   Nunca force push na `main`.
4. **Se a versão nova mudou o banco:** as migrações só andam para frente. Antes de voltar a imagem, o Mateus confere se a
   versão anterior funciona com o banco novo. Se não funcionar, o caminho é recriar o banco da homologação e rodar de
   novo o preparo dos dados de teste (`docs/infra/homologacao-dados-de-teste.md`); isso apaga o que foi feito no teste e
   gera senhas provisórias novas, entregues ao Lucas por fora.
5. Depois de voltar: avisar no chat do time o que voltou, abrir cartão Bug com o que quebrou e não mesclar nada na
   `main` até a correção estar revisada.

---

## 4. Problemas já encontrados (os mais graves primeiro)

Encontrados na passada de 08/10. Em 09/10, conferidos de novo no código e nos testes da `main`: os que os pedidos da noite
resolveram saíram das tabelas e estão em "Resolvidos desde 08/10", no fim desta seção. P22 e P23 são novos. Perfil, passo
e o que aconteceu. O que o #43 resolve está marcado "(resolvido no #43)" e continua valendo até ele subir.

### Graves: a jornada não segue pela tela, ou não dá para testar amanhã

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P1 | Jurídico administrativo | JA3: abrir "Marcar perícia médica" que nasce quando a advogada decide a perícia (caso Antônia Lima, servidor) | Abre "Esta tela ainda não foi construída". A tarefa que o sistema abre não leva à tela de marcar, e o "O INSS liberou o agendamento" ainda não tem botão. Conferido em 09/10: continua. Vem no pedido #30. **(resolvido no #43)**: a tarefa abre a tela de marcar, com o botão "O INSS liberou o agendamento" (JA3). | GGVP-31, GGVP-49, GGVP-137 |
| P4 | Atendimento, líder e Documentação | Central: "Marta · Agendar ida ao banco" e "Lúcia · Avisar a cliente do resultado" (Atendimento); "Antônio · Cumprir exigência do juiz" e "Pedro · Responder a exigência do INSS" (Documentação) | As quatro abrem "Esta tela ainda não foi construída". São tarefas de exemplo fixas do navegador; desde 09/10 cada uma aparece só na Central de quem faz. Nos casos do servidor, a exigência do juiz (Paulo Reis) e a exigência do INSS (Ulisses) funcionam; a ida ao banco é marcada pelo Financeiro (FI1). | GGVP-78 (CA3), GGVP-44, GGVP-83, GGVP-39, GGVP-98 |
| P5 | Advogada | Central: "Lúcia Exemplo · Prestação de contas: dar o OK" | Abre "Esta tela ainda não foi construída". Conferido em 09/10: continua. | GGVP-92 (ainda em "Refinada") |
| P7 | Jurídico administrativo e Advogada | JA2: confirmar presença, registrar comparecimento e conferir o resultado da perícia | Não dá para testar em 09/10: as perícias de exemplo ficam 9 dias à frente, e "Registrar" só libera depois da data. "Conferir resultado da perícia" nunca chega à Central da advogada. Os testes automáticos cobrem com o relógio adiantado. A perícia do servidor que chegaria ao resultado depende do P1. **(resolvido no #43 para a perícia do servidor)**: marcada para hoje, numa hora que já passou, ela chega ao comparecimento e ao resultado no mesmo dia (JA3, passos 5 a 8). As perícias do navegador continuam 9 dias à frente. | GGVP-66, GGVP-70 |
| P22 | Atendimento e Documentação | AT11: o lead novo depois da cópia do contrato | O caso segue para o checklist do benefício, mas documentos, checklist, cobrança e a primeira liberação ao Jurídico ainda são do navegador. O caso do lead novo não chega à fila da Sênior pela tela. Vem no pedido #22 (documentos) e no seguinte (liberação). | GGVP-125 |
| P23 | Todos que enviam mensagem | Qualquer envio pelo Chatwoot a um cliente do servidor (AT1, AT6, AT11, AD3) | Até o #28 subir, a homologação não tem a trava dos telefones de teste. Se o Chatwoot de verdade estiver ligado lá, a mensagem sai no WhatsApp do telefone da ficha. Confirme com o Mateus antes; a janela que diz "simulado" não envia nada. | GGVP-146 |

### Médios: segue, mas falta algo que o critério pede

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P8 | Sênior | SE4: "Despachar caso" do indeferido | A tela mostra o motivo e a carta, mas não traz a análise da IA nem sugestão de despacho. | GGVP-54 |
| P9 | Advogada | AD5: "Pedir a petição" | O texto da versão 1 vem vazio: a IA não escreve a petição; a advogada precisa colar o texto. | GGVP-63 |
| P10 | Advogada | AD8: "Paulo Mendes · Aprovar o resumo para o cliente" | O texto do resumo vem vazio: a IA não escreve o rascunho; a advogada escreve do zero. O resto funciona (aprovar, passar ao Atendimento, explicar, "Perdemos: estudo registrado"). | GGVP-22 (CA3) |
| P15 | Sócio | SO1: atribuir perfis a uma pessoa | Não há tela para isso; hoje só pelo comando no servidor. Conferido em 09/10: continua. | GGVP-96 |
| P17 | Atendimento, Documentação, Advogada, Sênior | Prazos do INSS e da Justiça | A tela avisa "Feriados não cadastrados: por enquanto o prazo só pula sábado e domingo" enquanto ninguém carregar os feriados. Desde a noite de 08/10, a Sênior carrega pela Configuração (SE6 passo 9); depois disso, o aviso some e o prazo pula os feriados. A homologação começa sem feriados. | GGVP-34, GGVP-39, GGVP-146 |
| P18 | Jurídico administrativo | JA2: chat "Perícias para marcar" | Responde "Nenhuma perícia espera marcação agora" mesmo com a perícia da Antônia (servidor) aberta. Conferido em 09/10: o chat ainda lê só as perícias do navegador. | GGVP-49, GGVP-82 |

**Atualização da noite de 08/10.** A IA jurídica entrou na `main` depois deste roteiro ter sido percorrido. Onde a chave da
IA estiver configurada na homologação, P8, P9 e P10 deixam de valer: a Sênior recebe a análise do indeferimento, a petição
chega com a versão 1 escrita pela IA e o resumo do resultado chega com o rascunho. Sem a chave, a tela avisa e a pessoa
escreve, como está acima. Entraram também a tela "Estudos de caso" (Jurídico) e a recomendação da perícia para a advogada;
essas duas não foram percorridas neste roteiro.

### Leves: texto e aparência

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P20 | Todos | Telas do navegador | Nomes de exemplo misturados: "Dra. Paula" e "Jéssica" nas telas do navegador; "Gabi (exemplo)" e "Fábio (exemplo)" no servidor. Conferido em 09/10: continua. | GGVP-125 |
| P21 | Advogada | AD2: transcrição e definir benefício da Josefa | A transcrição simulada é sempre a mesma (incapacidade, auxiliar de limpeza), e a IA sugere Auxílio por Incapacidade Temporária para uma lead de LOAS Idoso. A Josefa é do navegador: continua assim. No lead do servidor, a transcrição é de verdade com a chave da IA; a sugestão de benefício segue de exemplo. Depois que o #43 subir, no lead do servidor a IA também lê a entrevista e sugere os dados da ficha (AD1 passo 8); a Josefa continua igual. | GGVP-46, GGVP-51, GGVP-133 |

### Resolvidos desde 08/10

Conferidos em 09/10 no código e nos testes da `main`. Todos já estão na homologação (vieram até o #23).

| # | Como ficou | Pedido | Teste que prova |
|---|---|---|---|
| P2 | "Benedito Alves (exemplo) · Ajustar o caso: (o motivo)" abre "Ajustar o caso", com o que a Sênior pediu, o checklist e o parecer (AT9 passo 4) | #20 (GGVP-127) | `apps/web/e2e/via-administrativa.e2e.ts:90`; `apps/api/src/rotas/conferencia.test.ts:274` |
| P3 | "Vera Lúcia (exemplo) · Levar ao banco" abre a visita marcada, sem nenhum valor, com "Levei o cliente ao banco" e "Não deu" (AT7) | #23 (GGVP-98) | `e2e/via-administrativa.e2e.ts:231`; `apps/api/src/rotas/prestacao.test.ts:318` |
| P6 | Aba "Tarefas do setor" só para o líder do Atendimento e a Sênior, com "Atribuir" (LI1); a advogada e o Jurídico administrativo não têm mais a aba vazia | #20 (GGVP-147) | `e2e/tarefas-do-setor.e2e.ts:6` e `:19`; `apps/api/src/rotas/setor.test.ts:61` |
| P11 | Sênior, Financeiro e Sócio têm a busca e o chat "Pergunte ou peça" na tela inicial. A busca do Financeiro e do Sócio não acha cliente, porque eles não veem o caso (decisão do Lucas pendente). **(resolvido no #43 para o Sócio)**: ele lê tudo (Lucas, 07/10), acha o cliente e abre a ficha (SO1 passo 7). O Financeiro continua sem ver o caso | navegação por perfil (GGVP-135); #43 (GGVP-96) | `e2e/navegacao.e2e.ts:55`; `apps/web/src/paginas/CentralEmConstrucao.test.tsx:20`; no #43, `e2e/perfis.e2e.ts:33` |
| P12 | A Sênior busca a Rita, abre a ficha e clica "Dispensar o parecer" (SE2) | GGVP-135 | `e2e/navegacao.e2e.ts:15` |
| P13 | "Linha do tempo da deficiência" pela ficha (Jurídico, caso PCD); "Roteiros de laudos" no topo da Sênior; "Histórico do processo" pela ficha, no caso do servidor | GGVP-135 | `e2e/navegacao.e2e.ts:25` e `:39` |
| P14 | A Gestão (Tentativas bloqueadas, Prazos, Uso do cofre, Resultados, Configuração) no topo do líder | GGVP-135 | `e2e/navegacao.e2e.ts:48` |
| P16 | O kit mostra o nome do documento e a data da versão sem hora | GGVP-135 | `apps/web/src/paginas/Configuracao.test.tsx:60` |
| P19 | O histórico mostra os eventos com o nome da equipe, com acento | GGVP-135 | `apps/api/src/rotas/historico.test.ts:64` |

---

## 5. Ordem sugerida do dia

As jornadas passam a vez de um perfil para outro. Esta ordem evita esperar por um passo que outro perfil ainda não fez.

| Quando | Jornadas |
|---|---|
| Começo (09:00) | ENT (entrar), SE6 passo 9 (a Sênior carrega os feriados), AT1 (lead novo) → AD1 (entrevista do lead novo) → AT11 (o lead vira cliente e assina o contrato) → LI1 (líder vê o lead e distribui tarefas) |
| Manhã, antes das 15:30 | AT2 (agenda e Josefa) → AD2 (benefício e fechamento) → AT3 (documento e laudo) → AT4 (contrato) |
| Manhã | DO1, DO2 (documentos e checklist) → AD3 (parecer médico, com a Lúcia Prado do servidor) → AT5 (cobrança e pedido ao médico) → SE2 (dispensa) → DO3 (liberar) |
| Depois do almoço | SE1 (conferência) → JA1 (protocolo) → AD4 (INSS) → DO4 (exigência do INSS) → SE3 (cobrança no limite) → FI1 (Financeiro) → AT7 (banco) → FI1 passo 6 |
| Tarde | SE4 (despacho) → AT8 e DO5 (pendências) → AD5 (petição e Justiça) → SE5 (vigília e acervo) |
| Tarde | JA2 (perícia) → DO6 (documentos da perícia) → AD6 (página da perícia) |
| Fim | AD8 (resumo do resultado) → AT10 (explicar ao cliente), AT6 (relacionamento, com o lead de AT1), AT9 (chat, caso devolvido e limites), AD7 (chat e caso), SE6 (gestão) → SO1 (Sócio) |

Depois que o #43 subir, encaixe assim:

| Onde | O que entra |
|---|---|
| No começo | ENT passos 7 a 11 (as Centrais novas e o "Sem permissão"); SE7 (a Central da Sênior) |
| Com AD1 | AD1 passos 7 a 9 (sem microfone; a IA lê a entrevista; o áudio toca) |
| Com AT6 | AT6 passo 9 (a conversa presencial sem microfone) |
| Logo depois de AD4 passo 1 e de JA1 passo 3 | JA3 passos 2 a 8 (a perícia do servidor até o resultado, no mesmo dia) |
| Com AD5 passo 8 | JA3 passo 9, opcional (a perícia pedida pelo juiz) |
| Com FI1 | FI1 passo 9 (o painel Financeiro), antes e depois de cada passo do Financeiro |
| Com LI1 e AD7 | LI1 passo 7 (Clientes) e AD7 passo 8 (Processos) |
| Fim | SO1 passos 6 e 7 (o painel Financeiro e a ficha, pelo Sócio) |

---

## 6. Jornadas por perfil

Cada passo: o que fazer, o resultado esperado e a história que ele prova. "Percorrida em 08/10" diz como foi a passada.
"Conferida em 09/10" quer dizer que a jornada mudou com as mesclas da noite e foi conferida no código e nos testes, sem
passada no navegador. "(depois que o #43 subir)" quer dizer que o passo, ou a parte dele, só vale com o #43 na
homologação; antes disso, pule.

### Entrar (todos os perfis) · ENT

Simulado nesta jornada: nada; o login é de verdade, no servidor.

Percorrida em 08/10: passou. À mão: passos 4 e 5. Só nos testes automáticos (que passaram): 1 a 3. Os passos 7 a 11
valem depois que o #43 subir. Seguem os testes automáticos do #43 (`e2e/centrais-e-financeiro.e2e.ts`,
`e2e/perfis.e2e.ts:33` e `:53`, `e2e/clientes-e-processos.e2e.ts:42`; `App.test.tsx:229`; `FichaCliente.test.tsx:27`),
que ainda não rodaram no GitHub por causa da cobrança. Não foram percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Abra o endereço da homologação sem estar logado | Vai para a tela "Entrar" | GGVP-117 |
| 2 | Entre com provisoria@exemplo.ggv e a senha recebida | Pede para trocar a senha antes de entrar; depois da troca, abre a Central do Atendimento | GGVP-117 |
| 3 | Saia; entre com trava@exemplo.ggv e erre a senha 5 vezes; tente a certa | Mensagem única que não diz qual campo errou; na 5ª, trava por 15 minutos, mesmo com a senha certa | GGVP-117 |
| 4 | Entre com semperfil@exemplo.ggv | "Sem perfil, fale com a gestão." e nenhuma tela de caso | GGVP-117, GGVP-96 |
| 5 | Entre com cada perfil e veja a tela inicial | Cada perfil cai na sua Central: Atendimento, Advogada, Jurídico administrativo, Sênior, Financeiro e Sócio têm Central própria; a Documentação usa a Central do Atendimento, só com as tarefas dela. Sênior, Financeiro e Sócio têm a busca e o "✦ Pergunte ou peça" | GGVP-78, GGVP-96, GGVP-130, GGVP-135 |
| 6 | Como Atendimento, abra o endereço de uma tela do Jurídico (peça à advogada o link da tela "Preparar entrevista") | "Sem permissão"; a tela não abre. Conferida em 09/10 (#14), só nos testes automáticos | GGVP-96 (CA11), GGVP-135 |
| 7 | (depois que o #43 subir) Entre com senior@, financeiro@ e socio@exemplo.ggv e veja a tela inicial de cada um | Sênior: a aba do navegador diz "Início da Sênior"; a busca, o chat com "O que estourou o limite?" e as abas "Minhas tarefas" e "Tarefas do setor" (SE7). Financeiro: a aba diz "Início do Financeiro"; a busca, o chat com "Prestações recebidas" e a fila dele (FI1). Sócio: a tela "Resultados do escritório", com a busca e o chat com "Êxito por benefício" em cima (SO1). Nenhum dos três cai mais na Central provisória | GGVP-78, GGVP-96 |
| 8 | (depois que o #43 subir) Como financeiro@: olhe o topo. Depois, peça ao líder os links de "Prazos", "Configuração" e "Clientes" e abra cada um | No topo, da Gestão só "Resultados", e "Financeiro". Os três links mostram "Sem permissão" | GGVP-96, GGVP-78 |
| 9 | (depois que o #43 subir) Como documentacao@, na mesma aba de AT4: peça ao Atendimento o link de "Cleide Exemplo · Preparar contrato" e abra. Depois, pela busca do topo, abra a ficha do lead de AT1 | O contrato mostra "Sem permissão". A ficha abre, mas sem o cartão "Dados bancários para o repasse" | GGVP-96 |
| 10 | (depois que o #43 subir) Como juridico@: peça à advogada o link da gravação de uma entrevista (AD1 passo 3) e abra | "Sem permissão": a entrevista é da advogada e da Sênior | GGVP-96 |
| 11 | (depois que o #43 subir) Como senior@, abra o link do painel Financeiro (peça ao Financeiro). Como atendimento@, abra o link de "Paulo Reis (exemplo) · Manifestar no processo" (peça à advogada, AD5 passo 9) | As duas mostram "Sem permissão". A manifestação é peça jurídica: só o Jurídico abre | GGVP-96, GGVP-78 |

### Atendimento (atendimento@exemplo.ggv)

#### AT1 · Lead novo no balcão, até a entrevista marcada (servidor)

Simulado nesta jornada: a pasta do Drive é de exemplo. O convite passa pelo servidor e só sai de verdade se o Chatwoot
estiver ligado na homologação (P23: olhe se a janela diz "simulado"). O lead, a agenda e a confirmação gravam no
servidor. Use um telefone de teste combinado com o Mateus. O lead deste passo segue em AD1, AT11 e AT6.

Percorrida em 08/10: passou; o lead novo apareceu para o líder em outro navegador, com a entrevista na agenda. À mão: passos 1 e 3 a 7. Só nos testes automáticos: 2 e 8. O passo 9 é novo: conferido em 09/10 (#14), não percorrido.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Na Central, clique em "Balcão · Receber quem chegou" e busque um nome que não existe | "Ninguém com esse nome, CPF ou telefone" e o botão "+ Novo cliente" | GGVP-16 |
| 2 | "+ Novo cliente": nome, idade, telefone e o que a pessoa pretende; tente digitar letra no CPF, no telefone e na idade | Letra não entra nesses campos | GGVP-16 (CA15) |
| 3 | Digite o CPF de um cliente que já existe (por exemplo, o do Antônio Exemplo) | "Já existe?" avisa "Este CPF já está na ficha de Antônio Exemplo"; salvar leva à ficha que já existe, sem criar outra | GGVP-16 (CA6), GGVP-125 |
| 4 | Apague o CPF repetido e clique "Salvar e marcar a entrevista" | Abre "Marcar a entrevista com …" com os próximos dias livres e o convite em prévia | GGVP-123, GGVP-125 |
| 5 | Escolha o primeiro dia, 10:30, com a advogada e a duração; "Marcar" e "Enviar" no Chatwoot | "Entrevista marcada para …"; "O convite foi enviado pelo Chatwoot e ficou em Últimos contatos" | GGVP-123 |
| 6 | "Ver na agenda" → aba Lista | A entrevista aparece no dia, como "agendado" | GGVP-123 |
| 7 | Na agenda, clique na entrevista → "Confirmar agendamento" → "Ligar" → "Confirmou a entrevista" → "Sim, a doutora prepara a conversa" → "Confirmar entrevista" | "Entrevista confirmada"; a advogada recebe "Preparar entrevista" (ver AD1); no histórico da ficha ficam a marcação e a confirmação | GGVP-21, GGVP-125 |
| 8 | Marque outra entrevista no mesmo horário de outra pessoa | Avisa "Este horário já tem …" e deixa "Marcar mesmo assim" | GGVP-123 (CA3) |
| 9 | A pessoa está no balcão: crie outro lead novo, "Salvar e marcar a entrevista" → em vez de marcar, "Iniciar entrevista (Transcrição)" | "✓ Entrevista iniciada agora · … · (a advogada)". Sem a ficha de atendimento: "Antes, a ficha de atendimento: preencha com a pessoa e salve («Preencher ficha», na sua Central)"; com a ficha salva, a advogada recebe «Preparar entrevista». Não cai em "Confirmar agendamento" | GGVP-40, GGVP-135 |

#### AT2 · Agenda e a entrevista da Josefa (navegador; antes das 15:30)

Simulado nesta jornada: Chatwoot e scanner; os dados da Josefa e da Natália ficam só nesta aba.

Percorrida em 08/10: à mão, os passos 2 e 5, depois das 15:30, e por isso a pendência "Preencher ficha" não apareceu (é o horário da entrevista; ver "Cuidados com o relógio"). Nos testes automáticos, com o relógio antes das 15:30, todos passaram.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Josefa Exemplo · Confirmar agendamento" → "Chatwoot" | A mensagem de confirmação do LOAS pede RG e CPF de todos da casa, renda e CadÚnico | GGVP-21 (CA1, CA8) |
| 2 | "Ligar" → "Confirmou a entrevista" → "Não, enviar a ficha à cliente" → "Confirmar entrevista" | Avisa a pendência "Preencher ficha" até 15:30; a Central mostra "Josefa Exemplo · Preencher ficha" | GGVP-21 (CA2, CA7) |
| 3 | Abra "Josefa · Preencher ficha" → "Digitalizar a ficha em papel (scanner simulado)" | A IA preenche a ficha; "Salvar ficha" fica desligado sem CPF e data de nascimento e sem conferir a senha do cofre com o papel | GGVP-24 (CA5, CA14) |
| 4 | Na ficha do Antônio, "Abrir a ficha de atendimento", preencha a data de nascimento, guarde a senha no cofre e "Salvar ficha" | Salva com campos em branco; o cartão mostra o que ficou em branco; a senha nunca aparece na tela | GGVP-24 (CA4, CA6, CA9) |
| 5 | Agenda → Lista → "Para confirmar se aconteceu": Natália → "Faltou" ou "Marcar como realizado" | Faltou: a tarefa volta para remarcar, com motivo; realizado: a advogada fica com o resultado | GGVP-123 (CA6 a CA9) |
| 6 | Agenda → "+ Novo evento" → compromisso interno | Entra na agenda, sem cliente | GGVP-123 (CA5) |

#### AT3 · Documento no balcão e laudo novo (navegador)

Simulado nesta jornada: scanner e a leitura da IA.

Percorrida em 08/10: passou. À mão: passos 1, 3, 4 e 5. Só nos testes automáticos: 2. Conferida em 09/10: desde o #20,
"Receber documento" é da Documentação (passo 1b).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Balcão: busque Antônio → "Entregar documento" → "Encaminhar" | "Encaminhado ao setor Documentação · ADM": a Documentação recebeu a tarefa "Receber documento". Na Central do Atendimento ela não aparece (aparece "Antônio Exemplo · Cobrar documento") | GGVP-17 (CA1), GGVP-130 |
| 1b | Saia e entre como documentacao@exemplo.ggv, **na mesma aba**: Central → "Antônio Exemplo · Receber documento" | Abre "Antônio Exemplo · Receber documento"; "Registrar" desligado | GGVP-17, GGVP-130 |
| 2 | "Papel — vai ao scanner" → "Digitalizar (scanner simulado)" → marque as duas conferências → "Registrar" | O lote lido aparece com o aviso de conferir o papel; "Registrado às …"; a tarefa sai da Central da Documentação | GGVP-17 (CA1, CA2, CA5, CA10) |
| 3 | Entre de novo como Atendimento, na mesma aba. Na ficha do Antônio, solte um PDF de laudo → "Enviar para a pasta do cliente" | Entra como "Laudo novo", aguardando o Jurídico: esse status o Atendimento vê; o conteúdo do laudo, não | GGVP-17 (CA6, CA9) |
| 4 | Na Central, anexe um laudo no chat e escreva "Esse é o laudo do Antônio. Atualizar." | O chat mostra um card; o laudo só sobe depois de "Confirmar e enviar ao Jurídico" | GGVP-17 (CA8), GGVP-82 |
| 5 | Balcão: Rita → "Outra etapa" → "Documentação · ADM" → "Encaminhar" | "Encaminhado ao setor Documentação · ADM"; fica no histórico da ficha | GGVP-16 (CA4, CA7, CA8) |

#### AT4 · Contrato: preparar, assinar e entregar a cópia (navegador)

Simulado nesta jornada: ZapSign, WhatsApp, impressora, scanner e a leitura do contrato pela IA.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Cleide Exemplo · Preparar contrato" | Kit das aposentadorias pelo Contrato Completo 2026, com 6 documentos, e cada campo com a origem; honorários "do modelo, sem campo para digitar" | GGVP-65, GGVP-69 (CA1, CA5, CA11) |
| 2 | "Os documentos foram aprovados?": "Sim" | "Gerar contrato" não libera: "Falta: Estado civil, Profissão, CPF, RG e Endereço." | GGVP-69 (CA3) |
| 3 | "Não, corrigir campos": preencha os campos (use um CPF que não é de outra ficha), o que corrigir e as quatro conferências → "Gerar contrato" | "Contrato gerado · versão 1". Com o CPF de outra ficha, recusa: "Este CPF já está na ficha de …" | GGVP-69 (CA6, CA7) |
| 4 | "Colher assinatura" → "Em papel na hora" → "Imprimir o kit" → "Digitalizar o contrato assinado" → "Concluir a assinatura" | "Concluir" só libera depois de digitalizar; o contrato assinado vai para a pasta do cliente | GGVP-77 |
| 5 | Central: "Nair Exemplo · Colher assinatura" → "Lembrar pelo WhatsApp" → "Enviar" | Lembrete com o mesmo link do ZapSign; a 2ª tentativa tira a tarefa da Central e sobe para a sênior | GGVP-72 (CA2, CA4, CA5, CA11, CA12) |
| 6 | Na assinatura da Nair: "Simular o retorno do ZapSign (assinado)" → "Simular a leitura da IA" | O arquivo final vai para a pasta do caso; "A IA leu o contrato assinado e reconheceu: tudo certo. Segue para a cópia." | GGVP-72 (CA3, CA6, CA10), GGVP-85 (CA1, CA7) |
| 7 | Central: "Cleide Exemplo · Entregar cópia do contrato" → "Imprimir cópia" → marque "cópia impressa da versão assinada" → quem recebeu → "Registrar entrega" | "Entrega registrada"; o caso segue para a conferência do checklist | GGVP-89 |

#### AT5 · Cobrar documento e pedir o complemento ao médico (navegador; depois de DO2 e AD3)

Simulado nesta jornada: Chatwoot e a orientação ao médico escrita pela IA.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Rita Exemplo · Cobrar documento" | Lista o que falta do checklist; limite de 2 tentativas com 3 dias entre elas (G15) | GGVP-101 |
| 2 | "Enviar cobrança" → "Enviar" no Chatwoot | A mensagem sai uma vez, fica no histórico; "Enviar cobrança" desliga até o próximo lembrete | GGVP-101 (CA1, CA4, CA6, CA11) |
| 3 | Central: "Rita Exemplo · Pedir complemento ao médico" | A orientação diz só o que o relatório precisa abordar, sem diagnóstico, CID, grau nem conclusão (G20); "Imprimir a orientação" e "Enviar orientação" | GGVP-29 |

#### AT6 · Relacionamento com o cliente (servidor; com o lead de AT1)

Simulado nesta jornada: o Chatwoot, se não estiver ligado na homologação (P23: olhe se a janela diz "simulado"). A
transcrição e o resumo da IA do que mudou são de verdade com a chave da IA; sem ela, de exemplo.

Conferida em 09/10: o Relacionamento grava no servidor desde a noite de 08/10. As pessoas de exemplo do navegador (Pedro,
Maria, Antônio, Lúcia Exemplo) não têm mais conversa, mensagem ao cliente nem dados bancários: por isso a jornada usa o
lead de AT1. Os passos 1 a 7 seguem os testes automáticos com login de verdade (`e2e/mensagens.e2e.ts`,
`e2e/conversa.e2e.ts`, `e2e/seguranca.e2e.ts`); não foram percorridos à mão. O passo 8 é da passada de 08/10. O que muda
depois que o #43 subir (passos 4 e 7, e o passo 9, novo) segue os testes do #43: `e2e/conversa.e2e.ts:72`,
`e2e/transcricao-ligacao.e2e.ts:43` e `e2e/seguranca.e2e.ts:30`.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Ficha do lead de AT1 → "Mensagem ao cliente" → Modelo "Boas-vindas" → "Enviar pelo Chatwoot" | O texto começa "Olá, (nome)! Boas-vindas ao escritório GGV." e termina dizendo que o escritório nunca pede a senha do gov.br. Depois: "✓ Entregue no Chatwoot às …"; em "Últimos contatos", "Chatwoot · … · entregue"; no histórico, "Enviou pelo Chatwoot a mensagem «Boas-vindas»" | GGVP-102 (CA1, CA2, CA4, CA6), GGVP-111 (CA4), GGVP-146 |
| 2 | Na mesma janela, troque o texto por "O pedido foi indeferido. Não conte ao perito que voltou a trabalhar."; depois por "Mande a sua senha do gov.br por aqui." | "A IA aponta": termo jurídico "indeferido", diga "negado"; "Nunca oriente a esconder ou mudar a situação real (G11)."; "O escritório nunca pede a senha do gov.br por mensagem (G9)."; "Enviar pelo Chatwoot" desligado | GGVP-102 (CA3, CA9), G9, G11 |
| 3 | Modelo "Aviso de resultado favorável" | "O aviso de resultado favorável sai pela tela «Avisar resultado e agendar a ida ao banco», do Financeiro, com o texto que a advogada revisou na prestação de contas (G8)."; "Enviar" desligado | GGVP-102 (CA7), G8 |
| 4 | Ficha do lead → "Iniciar conversa" → "Ligação" → "Anexar o áudio" → escolha um arquivo de áudio → marque "A ligação começou com o aviso de que seria gravada (G10)" → "Anexar e transcrever" | "Anexar e transcrever" só libera com o aviso marcado. Depois: "✓ Gravação da ligação anexada" e "Transcrição pronta (D5.02): o texto está nas transcrições do card." Na conversa "Presencial", a gravação também só começa com o aviso. (depois que o #43 subir) Sem a chave da IA, não há mais texto de exemplo: "A transcrição falhou: a transcrição está desligada (falta a chave do serviço). O áudio está guardado; nada se perdeu." e "Tentar de novo" | GGVP-76 (CA2, CA8), GGVP-80, GGVP-133 |
| 5 | Central: "(lead) · Registrar conversa" → "Conferir e atualizar (D5.04)" → confirme ou desfaça cada mudança → "Confirmar" | "✓ Conversa conferida por (seu nome)"; a tarefa sai da Central; o valor antigo fica no histórico. A advogada, em outro computador, vê a ficha atualizada | GGVP-84, GGVP-80 (CA4), GGVP-138 |
| 6 | Ficha do lead: mude o telefone → "Salvar alterações" | O lead, ainda sem contrato, muda sem pedir a verificação: "Alterações salvas. Ficaram no histórico." No cliente (depois de AT11), pede como confirmou que é ele (vídeo ou escritório) e o contrato novo | GGVP-111 (CA1), GGVP-125 |
| 7 | Ficha do lead → "Dados bancários para o repasse" → "Mudar dados bancários" → banco, agência e conta → "Cliente no escritório" e "A alteração vai em contrato novo" → "Pedir a mudança". Saia e entre como lider@exemplo.ggv, abra a ficha → "Confirmar a mudança (segunda pessoa)" | "Mudança pedida: espera a segunda confirmação." Depois: "Dados bancários mudados. O contato anterior recebeu o aviso pelo Chatwoot."; o antigo e o novo ficam no histórico. (depois que o #43 subir) O histórico da ficha, que todos do caso veem, guarda só o fato ("Mudou os dados bancários (cliente no escritório; em contrato novo; …"), sem banco, agência nem conta. O cartão com a conta continua para quem pede, confirma ou repassa | GGVP-111 (CA2, CA5), GGVP-96 |
| 8 | Ficha do Antônio (navegador) → "+ Nova demanda" → "Outro pedido" → benefício → "Abrir a nova demanda" | A demanda abre na mesma ficha e leva a marcar a entrevista | GGVP-124 |
| 9 | (depois que o #43 subir) Num computador sem microfone, ou com o microfone bloqueado no navegador: ficha do lead → "Iniciar conversa" → "Presencial" → "Iniciar conversa" → "Gravar" → marque "Avisei que a conversa será gravada" → "Começar a gravar" | Aparece "Sem microfone: (o motivo)", sem nenhuma fala de exemplo, com "Subir o áudio gravado fora" e "Registrar como sem áudio". Em "Registrar como sem áudio", escreva em "O que foi conversado" → "Registrar sem áudio": "✓ Conversa registrada sem áudio" e "O registro ficou no card, como "só registro"." | GGVP-76, GGVP-133 |

#### AT7 · Levar o cliente ao banco (servidor; depois de FI1 passo 5)

Simulado nesta jornada: nada; grava no servidor. Desde 08/10 quem avisa o cliente e marca a ida ao banco é o Financeiro
(GGVP-98); o Atendimento só leva.

Percorrida em 08/10, à mão: falhou no passo 1 (P3). Conferida em 09/10: resolvido pelo #23; os passos seguem o teste
automático `e2e/via-administrativa.e2e.ts:231`, não percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Vera Lúcia (exemplo) · Levar ao banco" | Abre "Levar ao banco": "Marcada pelo Financeiro", com a data, a hora, o local e "Quem leva: …"; "O que o cliente leva" (documento oficial com foto, CPF do cliente, carta de concessão ou a decisão da Justiça). Nenhum valor em R$ | GGVP-98, GGVP-44 (CA10) |
| 2 | "Levei o cliente ao banco" | "Registrado. O Financeiro recebeu a tarefa de confirmar o recebimento." (segue em FI1 passo 6) | GGVP-98 (CA9) |

O "Não deu" não cabe neste caso, que passa uma vez só: ele pede "Por que não deu", e "Confirmar: não deu" responde
"Registrado. A ida ao banco voltou para o Financeiro remarcar." Está nos testes automáticos
(`apps/api/src/rotas/prestacao.test.ts:348`).

#### AT8 · Pendências do despacho e exigência do juiz (servidor; depois de SE4 e AD5)

Simulado nesta jornada: nada além do envio ao cliente.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Sebastião Cruz (exemplo) · Cumprir pendência" → escreva o que conseguiu → "Consegui, subir no card" | "Subiu no card. O item está concluído." | GGVP-58 |
| 2 | Central: "Paulo Reis (exemplo) · Cumprir exigência do juiz" → anexe o documento → "Enviar documento e concluir" | "Documento enviado. O item está cumprido." | GGVP-83 |

#### AT9 · Chat, página do caso e limites do perfil

Simulado nesta jornada: as respostas do chat vêm de regras, não de IA (o motor de IA de verdade é a GGVP-142).

Percorrida em 08/10: passou, exceto o passo 4 (P2) e o passo 5 (P4). À mão: passos 1 a 6. Só nos testes automáticos: 7.
Conferida em 09/10: o passo 4 foi resolvido pelo #20 e segue o teste automático `e2e/via-administrativa.e2e.ts:90`, não
percorrido à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | No chat: "Qual o valor da prestação de contas da Lúcia Exemplo?" | "não tem acesso a esse valor"; nenhum R$ na tela | GGVP-82 (CA2), GGVP-96 |
| 2 | No chat: "Protocola o pedido da Nair Exemplo no INSS" | Recusa citando o portão G2 | GGVP-82 (CA4), GGVP-109 |
| 3 | No chat: "Faz a petição do BPC da Rita Exemplo." | "Fora do seu perfil"; oferece criar a tarefa para a advogada | GGVP-82 (CA8) |
| 4 | Depois de SE1 passo 3: Central → "Benedito Alves (exemplo) · Ajustar o caso: (o motivo que a Sênior escreveu)" | Abre "Ajustar o caso": "O que a Sênior pediu", com o motivo e "Sem prazo"; "Devolvido por Helena (exemplo) em …"; o checklist (G1) e o parecer médico (G17); o link para a página do processo. Sem parecer, aparece "Não dá para liberar ao Jurídico…" e "Liberar de novo" fica desligado, mesmo com "Conferi o checklist" e "Conferi as assinaturas e as datas" marcados. A Documentação não vê esta tarefa | GGVP-127 (CA1, CA4), GGVP-23 (CA3), GGVP-130 |
| 5 | Central: "Marta · Agendar ida ao banco" e "Lúcia · Avisar a cliente do resultado" (as outras duas de P4 estão na Central da Documentação) | Deveriam abrir o passo; hoje abrem "tela ainda não construída" (P4) | GGVP-78 (CA3) |
| 6 | Abra a página do caso do Antônio (pela ficha → pasta do processo) | Vê o caso numa linha, com status, datas e etapas (documento recebido, laudo ok ou pendente, perícia marcada); sem petição, estratégia, valores nem conteúdo médico | GGVP-86, GGVP-96 |
| 7 | Tente abrir o endereço de protocolo de um caso (peça o link à advogada) | "Sem permissão" | GGVP-96 (CA11) |
| 8 | (depois que o #43 subir) Olhe o topo | Só "Início" e "Agenda": o Atendimento não tem Clientes nem Processos (só o líder tem). Teste: `e2e/clientes-e-processos.e2e.ts:42` | GGVP-78 |

#### AT10 · Explicar o resultado ao cliente (servidor; depois de AD8)

Simulado nesta jornada: nada; grava no servidor.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Paulo Mendes (exemplo) · Explicar resultado" | O resumo aprovado pelo Jurídico, com o nome de quem aprovou; nada de estratégia interna | GGVP-22 (CA1, CA3) |
| 2 | "Sem contato, tentar de novo" | "Tentativa registrada. A tarefa continua aberta." | GGVP-22 (CA4) |
| 3 | Canal e o que foi explicado → "Expliquei ao cliente" | "Explicação registrada. Caso encerrado."; o caso fica "Perdemos: estudo registrado"; os contatos ficam com data e canal | GGVP-22 (CA2, CA4), GGVP-19 |

#### AT11 · O lead novo vira cliente e assina o contrato (servidor; depois de AD1)

Simulado nesta jornada: ZapSign, scanner, impressora e a leitura do contrato pela IA. O link do ZapSign pelo WhatsApp
não sai de verdade. Tudo o mais grava no servidor (#2): outra pessoa, em outro computador, vê.

Conferida em 09/10, nova. Segue o teste automático com login de verdade `e2e/recepcao-servidor.e2e.ts` (linhas 125, 230,
307 e 346), não percorrido à mão. O teste gera o contrato pelas rotas do servidor; a tela de preparar é a mesma da
Cleide (AT4). Depois da cópia, o caso para no checklist (P22).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Como advogada, ao encerrar a entrevista do lead (AD1 passo 4): "Definir o benefício (D1.12)" → "Aceitar: (o benefício sugerido)" → "Conferi a recomendação com a entrevista" → "Confirmar benefício" | "✓ Benefício definido: (o benefício)". Com cálculo, segue para "Calcular tempo e pontos", na Central da advogada | GGVP-51, GGVP-57, GGVP-125 |
| 2 | Como Atendimento: Central → "(lead) · Registrar fechamento" → "Sim, fechou" → "Registrar fechamento" | "✓ Fechou com o escritório: (primeiro nome) é cliente". Com "Não fechou", o motivo e "Não, arquivar o lead": "✓ Lead arquivado com o motivo" (G16) | GGVP-60, GGVP-125 |
| 3 | Em outro computador, como Atendimento: Central → "(lead) · Preparar contrato" | A tarefa aparece também lá. A tela é a de AT4: as condições do kit, os campos com a origem, "Gerar contrato" só com os campos completos e as quatro conferências; CPF de outra ficha é recusado | GGVP-65, GGVP-69, GGVP-125 |
| 4 | "Colher assinatura" → "Em papel na hora" → "Imprimir o kit" → "Digitalizar o contrato assinado (scanner simulado)" → "Concluir a assinatura" | "✓ Contrato assinado em papel". Papel só na entrevista presencial; por vídeo, só ZapSign ("ZapSign (digital)" → "Enviar para assinatura" → "Simular o retorno do ZapSign (assinado)": "✓ Contrato assinado pelo ZapSign") | GGVP-77, GGVP-72, GGVP-125 |
| 5 | "Simular a leitura da IA (D1.18)" → "Conferir contrato" → "Está tudo certo?" "Sim" → "Está certo — seguir" | "✓ Contrato conferido: segue para a cópia". Assinado pelo ZapSign, a leitura reconhece e vai direto à cópia | GGVP-85, GGVP-125 |
| 6 | "Entregar cópia do contrato" → "Imprimir cópia para o cliente" → marque "É a cópia impressa da versão assinada" → data e quem recebeu → "Registrar entrega" | "Impressa em … (impressora simulada)"; depois "✓ Entrega registrada". A advogada, em outro computador, abre a mesma cópia e vê "✓ Entrega registrada" | GGVP-89, GGVP-125 |

### Líder do Atendimento (lider@exemplo.ggv)

#### LI1 · Trocar de perfil, tarefas do setor e o lead visto em outro computador

Simulado nesta jornada: as tarefas de exemplo do navegador. As tarefas do setor e a atribuição gravam no servidor; o
quadro mostra só as tarefas do servidor.

Percorrida em 08/10, à mão: o passo 2 passou; o 3 falhou (P6) e o 4 (P14). O passo 1 passou nos testes automáticos.
Conferida em 09/10: o passo 3 foi resolvido pelo #20 (tarefas do setor) e o 6 pela navegação por perfil. Os passos 3 a 6
seguem os testes automáticos (`e2e/tarefas-do-setor.e2e.ts`, `e2e/navegacao.e2e.ts:48` e os de unidade de "Atribuir"),
não percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Clique em "Atendimento · líder ⌄" no topo | "Entrar como…" mostra só os dois perfis da pessoa; escolher "Atendimento" troca a Central | GGVP-96 (CA10) |
| 2 | Num computador ou navegador diferente do de AT1, busque no balcão o lead novo criado em AT1 e abra a agenda | O lead aparece na busca; a entrevista está na agenda | GGVP-125 |
| 3 | Como "Atendimento · líder": aba "Tarefas do setor (n)" | "Tarefas do setor · Atendimento", com todas as tarefas abertas do setor, de quem é cada uma ("sem responsável" quando ninguém) e o prazo; as sem responsável e as urgentes primeiro; filtro "Ver" por pessoa. O quadro explica: "Você é líder do Atendimento: vê tudo do setor e escolhe quem faz cada tarefa (Atribuir)." Se aparecer "Nenhuma tarefa aberta aqui.", faça os passos 3 a 5 depois de SE1 passo 3 (o "Ajustar o caso" do Benedito é uma tarefa do setor) | GGVP-147 (CA1) |
| 4 | Numa tarefa sem responsável: "Atribuir ▾" → "Atribuir tarefa" → em "Quem faz", escolha "Ana (exemplo)"; prazo, prioridade e um recado → "Atribuir" | "Quem faz" mostra a carga de cada pessoa ("n hoje"). Depois, a tarefa fica com a Ana e o botão vira "Reatribuir"; o histórico guarda quem atribuiu, para quem e quando. Há também "Deixar sem responsável" e "Abrir a tarefa" | GGVP-147 (CA2, CA4) |
| 5 | Saia e entre como atendimento@exemplo.ggv | A tarefa atribuída está no topo de "Minhas tarefas", com o recado. A Ana não vê a aba "Tarefas do setor" | GGVP-147 (CA2, CA3) |
| 6 | Volte como líder: no topo, "Prazos" | Abre "Prazos cumpridos e perdidos". O topo do líder tem a Gestão: Tentativas bloqueadas, Prazos, Uso do cofre, Resultados e Configuração | GGVP-96, GGVP-135 |
| 7 | (depois que o #43 subir) No topo, "Clientes" → em "Buscar por nome, CPF ou telefone", digite "Renato Dias" → na linha dele, clique "1 processo de Renato Dias (exemplo)" → na lista de processos, clique no nome | "Clientes" mostra uma linha, com "Êxito" e o CPF mascarado. O link da contagem abre "Processos" só daquele cliente, com "LOAS Deficiente". O nome abre a ficha. "Exportar CSV" baixa a lista e fica no histórico. Teste: `e2e/clientes-e-processos.e2e.ts:7` | GGVP-78 |

A Sênior também tem a aba "Tarefas do setor", com as do Jurídico ("Tarefas do setor · Jurídico"). A advogada e o
Jurídico administrativo não têm a aba.

### Documentação (documentacao@exemplo.ggv)

Desde o #20 (conferido em 09/10), a Documentação entra na Central do Atendimento, mas a fila mostra só o que é dela:
"Receber documento" do balcão, "Conferir documento", "Conferir checklist", "Liberar ao Jurídico", as exigências do INSS e
do juiz e os documentos da perícia. A cobrança, o contrato, o fechamento, o pedido ao médico e o "Ajustar o caso" ficam
na fila do Atendimento. As pessoas do navegador continuam só na aba: entre como Documentação **na mesma aba** em que o
Atendimento trabalhou. Testes: `apps/web/src/paginas/CentralAtendimento.test.tsx:104` e `:123`;
`e2e/receber-documento.e2e.ts:49`.

#### DO1 · Conferir os documentos lidos pela IA (navegador)

Simulado nesta jornada: a leitura e a classificação da IA.

Percorrida em 08/10: passou. À mão: passos 1 e 3. Só nos testes automáticos: 2.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Rita Exemplo · Conferir documento" | Documentos lidos pela IA, com divergência de nome, um em quarentena e um duplicado | GGVP-81 (CA7 a CA11) |
| 2 | "Reclassificar" o laudo como relatório médico | A correção do tipo fica no histórico; o checklist recalcula | GGVP-95 (CA1, CA2, CA10) |
| 3 | No duplicado, escolha "Manter os dois" (ou descartar o menos legível); marque "Conferi os documentos lidos pela IA" → "Arquivar" | Arquiva; documento em quarentena não conta no checklist | GGVP-81 |

#### DO2 · Checklist do benefício e boas-vindas (navegador)

Simulado nesta jornada: Chatwoot.

Percorrida em 08/10: passou. À mão: passos 1 e 2. Só nos testes automáticos: 3.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Rita Exemplo · Conferir checklist" | Checklist incompleto; "Liberar ao Jurídico: bloqueado", com a lista do que falta (G1) | GGVP-91 (CA1, CA3, CA5, CA7) |
| 2 | "Gerar cobrança das pendências" | A cobrança vai para o Atendimento (AT5); a conferência fica no histórico | GGVP-91, GGVP-101 |
| 3 | Para um cliente novo, envie as boas-vindas pelo Chatwoot | A mensagem sai uma vez e fica no histórico; quem já era cliente não recebe; sem telefone, vira "Reenviar boas-vindas" | GGVP-97 |

#### DO3 · Liberar ao Jurídico (navegador; depois de AD3 e SE2)

Simulado nesta jornada: o parecer sugerido pela IA.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Sebastião Exemplo · Liberar ao Jurídico" | Não libera: "Marque a circunstância do acidente: o que é obrigatório depende dela." | GGVP-47, GGVP-18 (CA2, CA5) |
| 2 | Abra "Liberar ao Jurídico" da Rita depois do parecer Insuficiente (AD3) | Travado: sem parecer Suficiente, não libera (G17); a janela do parecer mostra o resultado, sem o conteúdo médico | GGVP-33, GGVP-20 |
| 3 | Depois da dispensa pelas duas sêniores (SE2), abra de novo | Mostra a dispensa; com as conferências marcadas, "Liberar ao Jurídico" libera e a sênior recebe | GGVP-18 (CA1, CA6, CA7), GGVP-33 |

#### DO4 · Exigência do INSS (servidor; depois de AD4 passo 4)

Simulado nesta jornada: nada; grava no servidor.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Ulisses Rocha (exemplo) · Cumprir exigência do INSS" | Os itens pedidos pela advogada; "Entregar ao Jurídico" desligado | GGVP-39 |
| 2 | Registre uma cobrança (canal e resultado) | "Cobranças: 1 de 2" | GGVP-39, GGVP-94 |
| 3 | Anexe um documento em cada item → "Entregar ao Jurídico" | Cada item vira "Cumprido"; "A advogada recebeu a tarefa de responder" | GGVP-39 |

#### DO5 · Pendência do despacho e exigência do juiz (servidor; depois de SE4 e AD5)

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Sebastião Cruz (exemplo) · Cumprir pendência" → documento → "Enviar documento e concluir" | Mostra "Entregar até …"; "Documento enviado. O item está cumprido." | GGVP-58 |
| 2 | Central: "Paulo Reis (exemplo) · Cumprir exigência do juiz" → documento → "Enviar documento e concluir" | Mostra o prazo do processo; "O item está cumprido." | GGVP-83 |

#### DO6 · Documentos da perícia (navegador; depois de JA2 passo 2)

Simulado nesta jornada: a leitura da IA do que chega.

Percorrida em 08/10: passou. À mão: as duas telas abrem com a lista; o "Concluir" do passo 2 só nos testes automáticos.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Maria Exemplo · Reunir documentos da perícia" (nasce em JA2) | A lista do que a perícia pede, com "Anexar", "Registrar a falta" e "Cobrar" | GGVP-56 |
| 2 | Central: "Pedro Exemplo · Reunir documentos da perícia": anexe um, registre a falta dos outros com o porquê, marque as conferências → "Concluir" | "Concluir" só libera com tudo anexado ou com a falta justificada; a tarefa volta ao Jurídico administrativo | GGVP-56 (CA2, CA4, CA5, CA6) |

### Advogada (advogada@exemplo.ggv)

#### AD1 · Entrevista do lead novo (servidor; depois de AT1)

Simulado nesta jornada: o roteiro marcado pela IA. A transcrição é de verdade com a chave da IA (GGVP-133); sem ela,
sempre o mesmo diálogo. Depois que o #43 subir, sem a chave a transcrição falha com o motivo, sem diálogo de exemplo, e
com a chave a IA também lê a entrevista (passo 8).

Percorrida em 08/10: passou, todos os passos à mão, com a advogada em outro navegador. Depois do passo 5, o lead segue
no servidor até a cópia do contrato: jornada AT11. Os passos 7 a 9 valem depois que o #43 subir e seguem os testes do
#43 (`e2e/recepcao-servidor.e2e.ts:78` e `:128`; `EntrevistaAoVivoTranscricao.test.tsx:116`;
`Transcricoes.test.tsx:85` e `:136`; `apps/api/src/rotas/transcricao.test.ts:185`, `:225` e `:249`). Não foram
percorridos à mão. Se o microfone faltar no passo 3, siga o passo 7.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "(lead de AT1) · Preparar entrevista" | Resumo da ficha, pontos de atenção, a anotação do primeiro contato. (depois que o #43 subir) O bloco se chama "Resumo da ficha": é regra, não IA | GGVP-32 |
| 2 | "Analisar a ficha" → "Não" (não é acidentário) → "Confirmar" | "Análise registrada"; sem senha do gov.br, o Atendimento recebe "Renovar senha do gov.br" | GGVP-32, GGVP-36 |
| 3 | "Voltar à preparação" → "Iniciar entrevista (Transcrição)" → "Gravar" | "Começar a gravar" só libera depois do aviso de gravação ao cliente (G10) | GGVP-40 |
| 4 | Converse 2 minutos → "Encerrar e gerar resumo" | "Entrevista encerrada"; o áudio fica guardado; a transcrição fica pronta | GGVP-40, GGVP-46 |
| 5 | Em outro navegador, entre de novo como advogada | "Definir benefício" e "Cadastrar lead" do lead estão na Central | GGVP-125 |
| 6 | Como Atendimento, abra a ficha do lead | Vê o histórico, o status e as etapas; não abre a entrevista nem a transcrição, que são do Jurídico | GGVP-46 (CA4), GGVP-96 |
| 7 | (depois que o #43 subir) Num computador sem microfone, ou com o microfone bloqueado no navegador (no passo 3, ou com o lead do AT1 passo 9): "Gravar" → marque "Avisei o cliente que a conversa será gravada" → "Começar a gravar" | "Sem microfone: (o motivo)" e "Nada foi gravado nem transcrito…", sem nenhuma fala de exemplo. As saídas: "Subir o áudio gravado fora" (o áudio entra nesta gravação e vai para a transcrição) ou "Registrar como sem áudio" → "O que foi conversado" → "Registrar sem áudio": "✓ Entrevista registrada sem áudio" e "A anotação ficou no caso." Depois, "Definir o benefício (D1.12)" segue pela lista do escritório | GGVP-40 (CA8), GGVP-133 |
| 8 | (depois que o #43 subir) Com microfone, grave uns minutos e "Encerrar e gerar resumo" → "Ver a transcrição" | "O áudio ficou guardado no caso, para sempre: (o arquivo)." Com a chave da IA: "Transcrição pronta (D1.11): o resumo e as informações estão no caso, para conferir." Em "Informações extraídas · o que foi para a ficha", cada item vem com "dito aos mm:ss: «o trecho»", um campo "Corrigir: (o item)" e "Conferi: (o item)". Corrija um, marque dois → "Conferir e levar": os dois ficam "✓ conferida" e vão para a ficha, com o valor antigo no histórico; o corrigido leva também o que a IA ouviu (G14). Sem a chave: "A transcrição falhou: a transcrição está desligada (falta a chave do serviço)." e "Tentar de novo"; o áudio fica. Com a chave, mas sem a IA liberada para dado de saúde: "A IA não leu a entrevista: (o motivo). Leia a transcrição e preencha a ficha à mão." | GGVP-46 (CA6, CA7), GGVP-133 |
| 9 | (depois que o #43 subir) Na mesma janela das transcrições: "Abrir áudio" e "Abrir o texto final" | O áudio guardado toca, parte por parte; o texto final abre numa aba. Só quem entrevista (a advogada e a Sênior) abre, e cada leitura fica registrada | GGVP-133 |

#### AD2 · Josefa: segunda ficha, renovar senha, benefício, cálculo, cadastro e fechamento (navegador; antes das 15:30)

Simulado nesta jornada: transcrição, sugestão de benefício pelo acervo, scanner.

Percorrida em 08/10: passou. À mão: passos 1, 4, 5 (gravar e encerrar), 6 e 9. Só nos testes automáticos: 2, 3, 7, 8 e 10. Atenção ao P21 (a transcrição e a sugestão não combinam com uma lead de LOAS Idoso).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Como Atendimento, confirme a Josefa com "Sim, a doutora prepara a conversa"; saia e entre como advogada, na mesma aba | Central: "Josefa Exemplo · Preparar entrevista" | GGVP-21 (CA3), GGVP-32 |
| 2 | "Analisar a ficha" → "Sim — abrir 2ª ficha" → "Confirmar" | O Atendimento recebe "Preencher segunda ficha"; a entrevista espera | GGVP-28 |
| 3 | Como Atendimento: "Josefa · Preencher segunda ficha" → "Digitalizar a segunda ficha" → "Enviar segunda ficha" | As duas fichas ficam juntas; a parte médica vai direto ao Jurídico | GGVP-28 |
| 4 | Como Atendimento: "Josefa · Renovar senha do gov.br" → "Sim" → nova senha → "Guardar no cofre" | A senha vai ao cofre e nunca aparece; com "Não", pede o motivo e o aviso | GGVP-36 |
| 5 | Como advogada: grave e encerre a entrevista da Josefa → "Ver a transcrição" | Buscar na transcrição, marcar trecho como prova, "Conferir e levar" à ficha, "Enviar ao checklist" | GGVP-46 (CA1, CA2, CA6 a CA8) |
| 6 | Central: "Josefa · Definir benefício" | Sugestão da IA com os casos-base e os requisitos calculados por código (G19); se você escolher outro, pede o porquê e o seu prevalece (G3) | GGVP-51 |
| 7 | Escolha o benefício, marque "Conferi a recomendação" → "Confirmar benefício" | Com cálculo, segue para "Calcular tempo e pontos"; sem cálculo, para o fechamento | GGVP-51, GGVP-57 |
| 8 | "Calcular tempo e pontos": anos, meses, dias, pontos e regra → "Ainda não" → data prevista → "Concluir" | Guarda o cálculo; refazer guarda o anterior | GGVP-57 |
| 9 | Central: "Josefa · Cadastrar lead" | O cadastro vem preenchido pela ficha e pela entrevista; a diferença de telefone pede escolha; "Falta: …" até completar | GGVP-43 |
| 10 | Como Atendimento: Agenda → Natália → "Marcar como realizado" → Central do Atendimento "Natália · Registrar fechamento" → "Não fechou", motivo, recontato 15 dias | Agenda o retorno; arquivar o lead exige motivo; "Sim, fechou" vira cliente e segue para o kit | GGVP-60 |

#### AD3 · Documentação médica (navegador; depois de DO1 e DO2)

Simulado nesta jornada: tudo o que a IA lê, resume e sugere no parecer das pessoas do navegador (passos 1 a 6). No caso
do servidor (passos 7 a 9), a IA é de verdade com a chave da IA; sem ela, a leitura de exemplo.

Percorrida em 08/10: passou, exceto o passo 5 (P13). À mão: passos 1 a 5. Só nos testes automáticos: 6. Conferida em
09/10: o passo 5 tem caminho por clique (navegação por perfil); os passos 7 a 9 são novos, da documentação médica no
servidor, e seguem o teste automático `e2e/documentacao-medica-servidor.e2e.ts:8`, não percorrido à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Rita Exemplo · Dar parecer médico" | O roteiro do benefício item por item, com o trecho do documento; "A IA sugere Insuficiente"; "Registrar parecer" só libera com cada item conferido | GGVP-20, GGVP-93 |
| 2 | Confira cada item → "Insuficiente — pedir complemento" → ajuste o que o documento deve abordar → "Registrar parecer" | O pedido ao médico vai para o Atendimento (AT5); o texto não sugere diagnóstico, CID, grau nem conclusão (G20) | GGVP-20, GGVP-29 |
| 3 | Central: "Antônio Exemplo · Analisar laudo novo" → "Ir para o parecer" → "Suficiente — liberar" → "Registrar parecer" | Resumo e comparação com o laudo anterior; o parecer refeito fica no histórico; a ficha deixa de mostrar "Laudo novo" | GGVP-20 (CA6, CA7) |
| 4 | Central: "Davi Exemplo · Dar parecer médico" | Usa o roteiro infantil; a condição e as terapias pedem os relatórios por condição | GGVP-50 |
| 5 | Na busca do topo, "Cleide Exemplo" → ficha → no caso PCD, "Linha do tempo da deficiência" | Abre "Cleide Exemplo · Linha do tempo da deficiência", com os períodos com e sem deficiência e o enquadramento | GGVP-42, GGVP-135 |
| 6 | No parecer, "ver o roteiro" | A advogada vê o roteiro sem editar | GGVP-93 (CA1) |
| 7 | Central: "Lúcia Prado (exemplo) · Dar parecer médico" (caso do servidor) | Os "Itens obrigatórios" do roteiro, com o primeiro "ausente"; cada item com a "Conferência:" para marcar | GGVP-20, GGVP-132 |
| 8 | Marque "confere" em cada item → "Insuficiente — pedir complemento" → "Registrar parecer" | "O que o documento deve abordar" vem preenchido ("Qual é a natureza do impedimento do paciente?"…); depois, "✓ Parecer registrado: Insuficiente" | GGVP-20, GGVP-29, GGVP-132 |
| 9 | Como Atendimento, em outro computador: Central → "Lúcia Prado (exemplo) · Pedir complemento ao médico" → "Ligar" → "Não atendeu (caixa postal ou sem resposta)" → "Registrar ligação" | "Perguntas ao médico" começa com "1. Qual é a natureza do impedimento do paciente?"; em "Tentativas do pedido", "1ª · (data) · Ligação · sem resposta". A advogada vê a tentativa no histórico da ficha | GGVP-29, GGVP-132 |

Depois que o #28 subir: na ficha da Lúcia Prado, "Mensagem ao cliente" → modelo "Orientação para o médico (complemento)"
vem com a mesma orientação da tela, porque o pedido de complemento está aberto (P23 vale para o envio). Antes do #28, o
modelo fica travado.

#### AD4 · Via administrativa no INSS (servidor; depois de SE1)

Simulado nesta jornada: nada; grava no servidor. A vigília do Meu INSS é manual (a advogada traz a resposta).

Percorrida em 08/10: passou. À mão: passos 1 e 3 a 8. Só nos testes automáticos: 2.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Antônia Lima (exemplo) · Decidir perícia" → "Sim, o sistema abre a tarefa de perícia" → "Perícia médica" → "Definir" | "O sistema abriu a tarefa de perícia para o Jurídico administrativo" (ver JA3 e P1). (depois que o #43 subir) Essa tarefa abre a tela de marcar: siga em JA3 | GGVP-31 |
| 2 | Central: "Rita Gomes (exemplo) · Trazer a resposta do INSS" → "Deferido" → texto → "Registrar" sem anexo | Recusa: "Anexe a comunicação do INSS" | GGVP-35 |
| 3 | Anexe a comunicação → "Registrar" | "O sistema abriu Prestar contas"; o passo seguinte aparece na mesma tela | GGVP-35, GGVP-44 |
| 4 | Central: "Ulisses Rocha (exemplo) · Tratar exigência do INSS" → "Documentos", prazo 30 dias, itens, prazo da Documentação → "Criar a tarefa" | Prazo do INSS contado pelo sistema (G12), pulando os feriados se a Sênior já os carregou (SE6 passo 9; senão, o aviso do P17); "A Documentação recebeu o card" (DO4) | GGVP-39 |
| 5 | Depois de DO4: "Ulisses · Responder exigência no portal do INSS" → comprovante → "Registrar a resposta" | "O caso voltou para a vigília e espera o INSS analisar" | GGVP-39 |
| 6 | Central: "Vera Lúcia (exemplo) · Prestar contas" → valor 12.345,67, forma, prazo → "Conferi os valores" → "Concluir a prestação" | Honorários e repasse calculados pelo sistema (R$ 3.703,70 e R$ 8.641,97); "O Financeiro recebe e, depois, avisa o cliente e marca a ida ao banco" (FI1) | GGVP-44, GGVP-98 |
| 7 | Central: "Sebastião Cruz (exemplo) · Trazer a resposta do INSS" → "Indeferido", motivo do INSS e com as suas palavras, carta → "Registrar" | "O caso foi para a Justiça e a Sênior recebeu Despachar caso" | GGVP-48, GGVP-52 |
| 8 | Na vigília do caso, "Histórico do processo" | Quem fez o quê, com hora; ninguém edita nem apaga | GGVP-99 |

#### AD5 · Justiça: petição, publicações e exigência do juiz (servidor; depois de SE4 e AT8/DO5)

Simulado nesta jornada: a IA não escreve a petição (P9); o tribunal não recebe nada (o portal só monta o pacote).

Percorrida em 08/10: passou, com a ressalva do P9. À mão: passos 1 a 9 (o aviso do passo 6 sem prazo, só nos testes automáticos).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Sebastião Cruz (exemplo) · Pedir a petição" → escolha os documentos → texto da versão 1 → "Pedir a petição" | "A versão 1 foi para a conferência". Hoje o texto vem vazio (P9) | GGVP-63 |
| 2 | "Não está boa? Editar eu mesma" → nova versão com o que mudou → "Salvar nova versão" | "Versão 2 salva. Ela precisa de nova conferência"; "O que mudou" destaca o trecho novo | GGVP-67, G6 |
| 3 | Marque as três conferências → "Aprovar e enviar ao protocolo" | Pacote com a petição, a carta (Tema 350) e os documentos | GGVP-67, GGVP-71 |
| 4 | Veja as travas antes de protocolar | Sem o CPF do cliente no texto, "CPF conferido: falhando" e o protocolo fica bloqueado (G7); com o CPF, as três ficam ok | GGVP-71 |
| 5 | Confira as três travas pela evidência, número CNJ e comprovante → "Protocolar no tribunal" | "Petição protocolada. O processo entrou na vigília." | GGVP-71 |
| 6 | Central: "Otávio Lima (exemplo) · Ler publicação" → "Intime-se…" → "Intimação ou exigência" → "Classificar" sem prazo | Pede o prazo (1 a 120 dias) ou "sem prazo na decisão" | GGVP-74, GGVP-37 |
| 7 | Prazo 15 → "Classificar" | Prazo contado pelo lado seguro (G12), com os feriados do tribunal se já carregados (P17); abre "Analisar exigência do juiz" | GGVP-34, GGVP-37 |
| 8 | Central: "Paulo Reis (exemplo) · Analisar exigência do juiz" → "Precisa cumprir" → item para a Documentação e para o Atendimento → "Confirmar" | Cada setor recebe "Cumprir exigência do juiz"; "Falta: Atendimento, Documentação." Em "O juiz pediu perícia?", deixe tudo desmarcado; a perícia pedida pelo juiz é o JA3 passo 9, opcional | GGVP-79, G5 |
| 9 | Depois de AT8 e DO5: "Paulo Reis · Manifestar no processo" → anexe a versão → aprove (G6) → comprovante → "Manifestar e protocolar" | "Manifestação protocolada. O processo voltou para a vigília." | GGVP-87, G21 |

#### AD6 · Página da perícia e o perito (navegador)

Simulado nesta jornada: a orientação e a jurimetria do perito vêm de exemplo.

Percorrida em 08/10: passou; o resultado da perícia não dá para testar em 09/10 (P7). À mão: passos 1, 3 e 4. Só nos testes automáticos: 2.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Página da perícia da Maria (pelo caso) | Datas: documentos 10 dias antes, orientação 3 dias antes, véspera; o comprovante; "Quem é o perito?" | GGVP-49, GGVP-53 |
| 2 | Página da perícia do Antônio → "Ver a orientação" → "Ver a jurimetria do perito" | Orientação pelo perfil do perito, com a versão; a porcentagem vem com o número de casos e a data da base (G22) | GGVP-61, GGVP-73 |
| 3 | No chat: "Como o perito avalia?" | Abre a página do processo, com os números do sistema | GGVP-61, GGVP-82 |
| 4 | Central: "Antônio · Conferir resultado da perícia" | Não aparece em 09/10 (P7) | GGVP-70 |

#### AD7 · Chat e o caso numa linha só

Simulado nesta jornada: as respostas do chat vêm de regras, não de IA.

Percorrida em 08/10: passou. À mão: passos 1, 2, 4 e 5. Só nos testes automáticos: 3. Conferida em 09/10: os passos 6 e 7
são novos (#21, a página do processo pelo banco) e seguem o teste automático `e2e/caso.e2e.ts:68`, não percorrido à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | No chat: "O que falta no caso do Antônio Exemplo?" | Diz a fase e a próxima ação, com o link para o caso | GGVP-82 (CA1, CA3) |
| 2 | No chat: "Cria uma tarefa para a Documentação cobrar o laudo que falta do Antônio Exemplo até amanhã" → escolha → "Trocar" o responsável → "Confirmar e criar a tarefa" | Nada acontece antes de confirmar; "Feito: tarefa criada para …"; a ação aparece no caso como "feito pelo chat" | GGVP-82 (CA5, CA7, CA9), GGVP-106 |
| 3 | No chat: peça para liberar a Rita sem o parecer | Recusa e diz o portão que falta (G17) | GGVP-33 (CA3), GGVP-109 |
| 4 | Página do processo do Antônio | O caso numa linha: fases, quem espera quem, tarefas em andamento com responsável, dados do processo; histórico | GGVP-86 |
| 5 | Página do processo do Pedro → "✦ Suporte" → "O que falta aqui?" | Responde sobre o caso; a jurimetria vem do sistema | GGVP-82 (CA6, CA10) |
| 6 | Na busca do topo, "Maria Souza (exemplo)" (caso do servidor) → ficha → abra o processo | A página lê o caso do banco: etapas, "Tarefas em andamento" com o responsável, "Dados do processo" (com "Saúde (Jurídico)") e o laudo pelo nome ("Abrir Laudo médico (exemplo).pdf"). O que o banco não tem (juízo, laços dos setores, laudo novo) não aparece | GGVP-86, GGVP-146 |
| 7 | Saia e entre como Atendimento, na mesma página | "Petição, estratégia e valores não aparecem para o Atendimento."; o laudo aparece só como "Documento de saúde", e abrir diz "O conteúdo do laudo é só do Jurídico", sem o arquivo. Financeiro e Sócio não abrem o caso. (depois que o #43 subir) O Sócio abre e lê, com os valores, sem o conteúdo médico e sem a petição; o Financeiro continua sem abrir | GGVP-96 (CA12), GGVP-146 |
| 8 | (depois que o #43 subir) No topo, "Processos" → em "Autor, nº do processo ou CPF", digite "0005678-75.2026" → clique no número | Uma linha só. O número abre a página do processo da "Rosa Amaral (exemplo)"; o nome do autor abre a ficha. Teste: `e2e/clientes-e-processos.e2e.ts:28` | GGVP-78 |

#### AD8 · Resumo do resultado para o cliente (servidor)

Simulado nesta jornada: o rascunho da IA não existe (P10).

Percorrida em 08/10: passou, todos os passos à mão, com o texto escrito à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Paulo Mendes (exemplo) · Aprovar o resumo para o cliente" | O caso improcedente, sem recurso, e o campo "O que dizer ao cliente". Deveria vir com o texto da IA para a advogada completar; hoje vem vazio (P10) | GGVP-22 (CA3) |
| 2 | Escreva o resumo, sem estratégia interna → "O Atendimento, no padrão" → "Aprovar o resumo" | "Resumo aprovado. O Atendimento vai explicar ao cliente." (AT10). Se escolher ligar ela mesma, a tarefa fica com a advogada | GGVP-22 (CA3, CA5) |

### Sênior (senior@exemplo.ggv e senior2@exemplo.ggv)

#### SE1 · Conferência antes do INSS (servidor)

Simulado nesta jornada: nada; grava no servidor.

Percorrida em 08/10: passou. O ajuste que volta ao Atendimento não abria (P2). À mão: passos 1 a 3 (a recusa sem motivo, só nos testes automáticos). Conferida em 09/10: o ajuste abre desde o #20 (AT9 passo 4). Liberado de novo, o caso volta a esta fila com uma conferência nova, sem o OK anterior.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Antônia Lima (exemplo) · Conferir antes do INSS" → vê "Suficiente" → "Aprovar" | "Aprovado. O protocolo e a decisão de perícia foram abertos." (JA1 e AD4) | GGVP-23, G2 |
| 2 | Central: "Benedito Alves (exemplo) · Conferir antes do INSS" | "Aprovar" desligado (sem parecer, G17) | GGVP-23, GGVP-33 |
| 3 | "Reprovar, volta ao Atendimento" → "Confirmar reprovação" sem motivo; depois com motivo | Sem motivo: "Escreva o que o Atendimento precisa ajustar"; com motivo: "O caso voltou para o Atendimento ajustar" | GGVP-23 |

#### SE2 · Dispensa do parecer, com duas sêniores (navegador; depois de AD3)

Simulado nesta jornada: o parecer da IA.

Percorrida em 08/10: passou pelo endereço; não havia caminho por clique para a primeira sênior (P12). Todos os passos à
mão. Conferida em 09/10: o caminho por clique entrou com a navegação por perfil (`e2e/navegacao.e2e.ts:15`).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Na busca do topo, "Rita Exemplo" → ficha → no caso em andamento, "Dispensar o parecer" | Abre "Rita Exemplo · Dispensar o parecer médico". O link só aparece para a Sênior, e só com parecer a dar | GGVP-33, GGVP-135 |
| 2 | Justificativa → "Pedir a dispensa (1ª sênior)" | Fica esperando a segunda sênior | GGVP-33 (CA1, CA2) |
| 3 | Saia e entre com senior2@exemplo.ggv, na mesma aba: "Rita Exemplo · Aprovar dispensa do parecer" → "Aprovar a dispensa (2ª sênior)" | A dispensa vale; a liberação mostra a dispensa (DO3) | GGVP-33 (CA4) |

#### SE3 · Cobrança que passou do limite (servidor e navegador)

Percorrida em 08/10: passou. À mão: passos 1 e 2. Só nos testes automáticos: 3.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Wagner Costa (exemplo) · Cobrança sem retorno: exigência do INSS" | As 3 cobranças sem resposta; "Devolver ao setor" desligado sem o que fazer | GGVP-94, G15 |
| 2 | Escreva o que o setor deve fazer → "Devolver ao setor" | "A tarefa voltou ao setor, com o próximo lembrete em …"; a Documentação vê a decisão | GGVP-94 |
| 3 | Central: "Antônio Exemplo · Decidir cobrança" → justificativa → "Registrar decisão" | Volta ao Atendimento com a decisão | GGVP-101 (CA7, CA8, CA12) |

#### SE4 · Despacho do indeferido (servidor; depois de AD4 passo 7)

Simulado nesta jornada: a análise da IA não existe (P8).

Percorrida em 08/10: passou, sem a análise da IA (P8). À mão: passos 1 a 3. Só nos testes automáticos: 4.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Sebastião Cruz (exemplo) · Despachar caso" | Motivo do INSS, motivo com as palavras de quem viu, a carta; "Quem despacha é você" (G4). A análise e a sugestão da IA ainda não aparecem (P8) | GGVP-52, GGVP-54 |
| 2 | "Sim, falta" → Documentação (com prazo) e Atendimento (sem prazo) → "Despachar" | "Cada setor recebeu Cumprir pendência"; "Falta: Atendimento, Documentação." | GGVP-58 |
| 3 | Depois de AT8 e DO5 | A advogada recebe "Pedir a petição" | GGVP-58 |
| 4 | Em outro caso indeferido: "Encerrar sem judicializar" com o porquê | "Caso encerrado sem judicializar." | GGVP-52 |

#### SE5 · Vigília das publicações e acervo (servidor)

Simulado nesta jornada: as fontes do diário (AASP e DJEN) são de exemplo.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Vigília das publicações · Reprocessar vigília" | "Vigília incompleta" com a rodada que falhou, nunca como dia sem publicação (G13) | GGVP-30 |
| 2 | "Reprocessar" | "Reprocessada", com o seu nome | GGVP-30 |
| 3 | Fila de revisão: na "sem número do processo", informe o CNJ → "Vincular ao processo"; na de outro escritório, "Não é do escritório" | "A advogada recebeu para ler"; "Registrado: não é do escritório."; repetidas vão para "Descartes" | GGVP-26 |
| 4 | Central: "Acervo · Conferir desfechos do lote" → "Confere" num, "Corrigir" outro | Só os conferidos entram nas contas da jurimetria | GGVP-55 |

#### SE6 · Gestão do escritório (servidor)

Percorrida em 08/10: passou, com P16. À mão: passos 1, 3 a 6 e 8. Só nos testes automáticos: 2 e 7. Conferida em 09/10:
P16 e os caminhos dos passos 7 e 8 resolvidos pela navegação por perfil; o passo 9 é novo (feriados) e segue o teste
automático `e2e/feriados.e2e.ts:8`, não percorrido à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Topo → "Configuração" → mude "Cliente sumido: dias…" para 12 → salvar | "Parâmetro salvo."; fica no histórico da configuração | GGVP-104 |
| 2 | Escolha um benefício → acrescente um documento ao kit → "Publicar a versão" | "Kit publicado: a versão nova vale para os casos novos." O kit mostra o nome de cada documento e a data da versão sem hora | GGVP-104, GGVP-135 |
| 3 | Topo → "Tentativas bloqueadas" | Quem tentou passar por um portão, com perfil, caso e ação | GGVP-109 |
| 4 | Topo → "Uso do cofre" | Quem leu, cadastrou ou trocou a senha do gov.br; a senha nunca aparece | GGVP-103 |
| 5 | Topo → "Prazos" | Prazos cumpridos e perdidos | GGVP-94, GGVP-68 |
| 6 | Topo → "Resultados" | Indicadores com o número de casos e a data da base (G22); sem os totais em R$ | GGVP-75 |
| 7 | Topo → "Roteiros de laudos" → LOAS Deficiente: editar um item e salvar | Salva a versão 2 | GGVP-93, GGVP-135 |
| 8 | Na busca do topo, "Ulisses Rocha (exemplo)" → ficha → no caso, "Histórico do processo" → motivo → "Pedir a exportação" | Abre "Histórico do processo"; depois, "Pedido enviado. A direção recebeu a tarefa de autorizar a exportação." | GGVP-99 (CA12), GGVP-135 |
| 9 | Topo → "Configuração" → "Feriados e suspensões dos tribunais" → "Carregar os feriados da lei de 2026 e 2027". Depois, acrescente um dia ("Dia", "Vale para", "O que é" → "Acrescentar") e tire-o | "Feriados da lei de 2026 e 2027: (n) dia(s) acrescentado(s)."; "Acrescentado: (dia)."; "Tirado: (dia)."; cada mudança fica em "Histórico dos feriados" com o seu nome. O Financeiro vê a lista, sem botões. (depois que o #43 subir) Quem vê a lista sem botões é a líder do Atendimento; o Financeiro não tem mais a Configuração e vê "Sem permissão" (`e2e/feriados.e2e.ts:8`) | GGVP-34, GGVP-146, GGVP-96 |

#### SE7 · A Central da Sênior (depois que o #43 subir)

Simulado nesta jornada: as respostas do chat vêm de regras. Parte da fila são tarefas de exemplo do navegador.

Conferida em 09/10 só no código e nos testes do #43 (`e2e/centrais-e-financeiro.e2e.ts:7`; `CentralSenior.test.tsx:41`,
`:63` e `:75`), não percorrida à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Entre como senior@exemplo.ggv | A aba do navegador diz "Início da Sênior". A busca e o chat "Pergunte ou peça", com "O que estourou o limite?", "Criar tarefa", "Casos para conferir" e "Subir no acervo". As abas "Minhas tarefas" e "Tarefas do setor", e a aba Suporte | GGVP-78 |
| 2 | Olhe "Minhas tarefas" | As tarefas do servidor no topo (conferências antes do INSS, despachos, exigências vencidas, vigília, estudos, acervo) e as de exemplo (cobrança e remarcação no limite, dispensa do parecer, complemento a decidir). Cada linha abre o passo (SE1 a SE5) | GGVP-78 |
| 3 | Olhe o topo | Início, Agenda, Clientes, Processos, Estudos de caso, Roteiros de laudos, a Gestão (Tentativas bloqueadas, Prazos, Uso do cofre, Resultados, Configuração) e "Importar planilha". Sem "Financeiro" | GGVP-78, GGVP-96 |
| 4 | Se a fila ficar vazia | "Nada na sua fila agora." e o botão "Buscar um cliente", que leva à busca | GGVP-78 (CA4) |

### Jurídico administrativo (juridico@exemplo.ggv)

#### JA1 · Protocolar no Meu INSS, com o cofre (servidor; depois de SE1)

Simulado nesta jornada: o Meu INSS é fora do portal; o portal só registra.

Percorrida em 08/10: passou. À mão: passos 1, 2 e 4. Só nos testes automáticos: 3.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Maria Souza (exemplo) · Protocolar no Meu INSS" | "OK recebido" da Sênior (G2) e os documentos na ordem | GGVP-27 |
| 2 | "Ver a senha do gov.br" → confirme com a sua senha do portal → "Mostrar por 60 segundos" | A senha aparece por 60 segundos; a leitura fica no "Uso do cofre" | GGVP-103 |
| 3 | Para a Antônia (sem senha): "Cadastrar a senha do gov.br no cofre" → "Guardar no cofre" | "Senha guardada no cofre." | GGVP-103 |
| 4 | Número do requerimento, DER, comprovante → "Registrar protocolo" (desligado até marcar "Revisei o requerimento") | "Protocolo registrado. O caso agora espera o INSS." | GGVP-27 |

#### JA2 · Perícia: marcar, orientar e comparecer (navegador)

Simulado nesta jornada: a leitura do comprovante, a orientação da IA e o envio pelo Chatwoot.

Percorrida em 08/10: passou até a orientação; comparecimento e resultado só depois da data (P7). À mão: passos 1 a 5. Só nos testes automáticos: 6.

Conferida em 09/10: esta jornada usa as pessoas do navegador e não mudou. A Perícia grava no servidor desde a noite de
08/10, mas a perícia que o servidor abre ainda não chega à tela de marcar (JA3, P1; vem no pedido #30, resolvido no
#43). Saúde na
Perícia, depois que o #17 subir: fora do Jurídico, todos do caso veem o resultado, a etapa, o histórico, as tentativas e
a orientação; só a leitura do laudo e os laudos do perfil do perito ficam com o Jurídico
(`apps/api/src/rotas/pericia.test.ts:389`; `e2e/pericia-servidor.e2e.ts:19`).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Maria Exemplo · Marcar perícia" → "Não, tentar de novo" → dia e o que aconteceu → "Registrar a tentativa" | "Tentativa registrada: a tarefa continua com você e volta amanhã." | GGVP-53 (CA1) |
| 2 | "Sim, marcado" → comprovante do INSS → confira o que foi lido → "Sim: atribuir à Documentação" → "Registrar a perícia" | "Perícia registrada"; vai para a agenda e a ficha; a Documentação recebe "Reunir documentos da perícia" (DO6) | GGVP-53 (CA2 a CA4), GGVP-56 |
| 3 | No chat, "Perícias para marcar" | Lista o que espera marcação. Hoje ignora a perícia que nasceu no servidor (P18) | GGVP-49 |
| 4 | Central: "Antônio Exemplo · Orientar para a perícia" → revise → "Revisei a orientação" → "Enviar orientação" | Texto que proíbe esconder a situação não sai (G11); enviado, a tarefa sai da Central | GGVP-62, GGVP-61 |
| 5 | Página da perícia do Antônio → "Confirmar presença" | Mostra "A confirmação entra na sua Central na véspera"; "Registrar" só depois da data (P7) | GGVP-66 |
| 6 | Página do processo do Pedro → "Identificar o perito" em um clique | O perito fica ligado; a orientação passa a ser pelo perfil dele | GGVP-73, GGVP-61 (CA5, CA6) |

#### JA3 · Perícia aberta pelo servidor (depois de AD4 passo 1)

Simulado nesta jornada: o Meu INSS é fora do portal; a leitura do comprovante e do laudo pela IA só com a chave. Tudo o
mais grava no servidor: cada pessoa pode estar no seu computador.

Percorrida em 08/10, à mão: falhou no passo 2 (P1). Conferida em 09/10: continua; vem no pedido #30. Os passos 2 a 9
valem depois que o #43 subir. Seguem o teste automático do #43 `e2e/pericia-servidor.e2e.ts:20` (feito com outro caso
de exemplo, o José Ramos) e os testes de tela e de servidor (`PericiaNoServidor.test.tsx`;
`apps/api/src/rotas/pericia.test.ts:433` a `:548`). Não foram percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central | "Antônia Lima (exemplo) · Marcar perícia médica" aparece sozinha, sem ninguém criar | GGVP-31, GGVP-49 |
| 2 | Clique na tarefa | Deveria abrir "Marcar perícia"; hoje abre "tela ainda não construída" (P1, vem no pedido #30). (depois que o #43 subir) Abre a tela de marcar da Antônia, com "Esperando o INSS liberar o agendamento (D2.E1)" e o botão "O INSS liberou o agendamento" | GGVP-49, GGVP-137 |
| 3 | (depois que o #43 subir) "O INSS liberou o agendamento" (quando o Meu INSS mostrar o agendamento liberado). Depois, volte à Central | "Liberação registrada: marque a perícia pelo Meu INSS." A marcação abre na mesma tela. Na Central, a Antônia aparece uma vez só: "Antônia Lima (exemplo) · Marcar perícia"; a "Marcar perícia médica" sai | GGVP-49, GGVP-137 |
| 4 | (depois que o #43 subir; depois de JA1 passo 3) Abra "Antônia Lima (exemplo) · Marcar perícia" → em "Meu INSS", "Ver a senha do gov.br" → confirme com a sua senha do portal | A senha aparece pelos segundos do cofre, como no protocolo (JA1 passo 2), e some sozinha; a leitura fica em "Uso do cofre" | GGVP-103, GGVP-137 |
| 5 | (depois que o #43 subir) "Sim, marcado" → suba um PDF em "Comprovante do INSS (PDF)" → em "Lido do comprovante · confira", preencha Data, Hora e Local → "Sim: atribuir à Documentação" → "Registrar a perícia" | Sem a chave da IA, o quadro diz "A IA não leu o comprovante agora" e a pessoa preenche olhando o PDF. Depois: "✓ Perícia registrada". Para chegar ao resultado hoje, use a data de hoje e uma hora que já passou, como o teste automático; com data futura, o comparecimento só abre depois (P7) | GGVP-53, GGVP-137 |
| 6 | (depois que o #43 subir) Como documentacao@, em qualquer computador: Central → "Antônia Lima (exemplo) · Reunir documentos da perícia" → no item "Laudo médico recente (até 30 dias)", "Anexar" um PDF | "Anexado: Laudo médico recente (até 30 dias), na pasta do caso."; na lista, o item fica "anexado: (o nome do arquivo)". O arquivo vai para a pasta do caso; na perícia médica, só o Jurídico abre | GGVP-56, GGVP-137 |
| 7 | (depois que o #43 subir) Como juridico@, depois da hora marcada: Central → "Antônia Lima (exemplo) · Registrar comparecimento" → "Compareceu" → "Registrar" | "✓ Comparecimento registrado" | GGVP-66, GGVP-137 |
| 8 | (depois que o #43 subir) Como advogada@: Central → "Antônia Lima (exemplo) · Conferir resultado da perícia" → suba um PDF em "Laudo ou registro do GERID" → "Favorável — seguir" → marque as conferências → "Registrar resultado" | Sem a chave da IA, "A IA não leu o laudo agora". Depois: "✓ Resultado registrado: favorável". A página da perícia do caso abre em "Perícias". Fora do Jurídico, a perícia mostra o resultado, sem a leitura do laudo (#17) | GGVP-70, GGVP-137 |
| 9 | (depois que o #43 subir; opcional) Perícia pedida pelo juiz: em AD5 passo 8, marque também "Perícia médica" em "O juiz pediu perícia?". Como juridico@, abra a tarefa de marcar a perícia do Paulo Reis (exemplo) → em "Data que o juízo designou", preencha a data, a hora e o local → "Registrar a data do juízo" | A tela diz "A data ainda não saiu na publicação": a perícia judicial não tem Meu INSS nem comprovante. Depois: "Data do juízo registrada: na agenda e na ficha, com o lembrete da véspera agendado." A leitura sozinha da data na publicação não dá para ver aqui: a intimação de exemplo do Paulo Reis não traz data (está em `apps/api/src/rotas/pericia.test.ts:505`). **Atenção:** a manifestação do AD5 passo 9 passa a esperar o resultado dessa perícia, ou que a advogada a encerre com o motivo. Faça este passo só se o AD5 passo 9 puder esperar | GGVP-53, GGVP-79 (CA8), GGVP-137 |

### Financeiro (financeiro@exemplo.ggv)

#### FI1 · Receber a prestação, avisar o cliente e marcar a ida ao banco (servidor; depois de AD4 passo 6)

Simulado nesta jornada: o aviso ao cliente não sai de verdade (o Financeiro revisa a mensagem e marca "Revisei e
enviei"). Desde o #23, quem leva registra a ida (AT7), e a confirmação do recebimento chega ao Financeiro como tarefa.

Percorrida em 08/10: passou, todos os passos à mão, depois da mescla do Desfecho e financeiro. A Central fica vazia até a
advogada concluir uma prestação. Os passos 1, 7 e 8 mudam e o passo 9 entra depois que o #43 subir. Seguem os testes do
#43 (`e2e/centrais-e-financeiro.e2e.ts:23`; `CentralFinanceiro.test.tsx:41` a `:62`; `Financeiro.test.tsx:63` e
`:85`; `apps/api/src/rotas/financeiro.test.ts:77`; `e2e/perfis.e2e.ts:33`), não percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Entre antes de AD4 passo 6 | "Nada na sua fila agora.", com a busca e o "✦ Pergunte ou peça". A busca do Financeiro acha só as tarefas dele, não cliente (ele não vê o caso). (depois que o #43 subir) A aba do navegador diz "Início do Financeiro"; o chat sugere "Prestações recebidas"; com a fila vazia, aparece também "Abrir o painel Financeiro" | GGVP-78, GGVP-135 |
| 2 | Depois de AD4 passo 6: "Vera Lúcia (exemplo) · Receber a prestação de contas" | Repasse ao cliente R$ 8.641,97; "Receber e lançar" desligado até marcar "Valores conferem com o comprovante" | GGVP-44, GGVP-98 |
| 3 | Marque a conferência → "Receber e lançar" | "Recebimento lançado. Agora avise o cliente e marque a ida ao banco." | GGVP-98 |
| 4 | Central: "Vera Lúcia · Avisar resultado e agendar a ida ao banco" → data, hora, agência, quem do Atendimento leva → "Agendar" | Mensagem pronta: "Seu benefício foi concedido. A ida ao banco está marcada para … Ana (exemplo), do escritório, vai com você." | GGVP-98, GGVP-44 |
| 5 | Revise e "Revisei e enviei" | O aviso fica registrado com o canal e quem enviou; o Atendimento recebe "Levar ao banco" (AT7) | GGVP-98, G8 |
| 6 | Depois de AT7 ("Levei o cliente ao banco"): Central → "Vera Lúcia (exemplo) · Confirmar o recebimento: cliente levado ao banco" → "Confirmar recebimento" | "Recebimento confirmado. Caso encerrado." Conferido em 09/10 (#23), no teste automático `e2e/via-administrativa.e2e.ts:231` | GGVP-98 (CA9) |
| 7 | Topo → "Resultados" | Os totais em dinheiro do escritório (honorários recebidos, tempo até o dinheiro). (depois que o #43 subir) É o único item da Gestão no topo dele. "Honorários recebidos" e "Tempo até o dinheiro" contam pela confirmação do recebimento (passo 6), não pelo "Receber e lançar" | GGVP-75, GGVP-96 |
| 8 | Topo → "Configuração" | Só leitura: sem botões de salvar ou publicar. (depois que o #43 subir) Não há mais "Configuração" no topo; pelo link, "Sem permissão" | GGVP-104, GGVP-96 |
| 9 | (depois que o #43 subir) Topo → "Financeiro". Volte aqui antes e depois dos passos 2, 3 e 6 | O painel "Financeiro", com o período: os cartões "Recebido no mês", "A receber", "Prestações de contas a lançar" e "Em atraso"; "Receita por mês"; "Por origem · últimos 12 meses"; "Prestações de contas pendentes"; a tabela "Lançamentos", com a Vera Lúcia (exemplo), os filtros, "Limpar" e "Exportar CSV". A Vera Lúcia muda de etiqueta a cada passo: "Aguardando OK" enquanto a advogada não conclui a prestação; depois, "Lançar", que abre o recebimento (passo 2); depois de "Receber e lançar", "A receber"; depois do passo 6, "Recebido", e o valor entra em "Recebido no mês". O nome do cliente abre a prestação de contas | GGVP-78, GGVP-98 |

### Sócio (socio@exemplo.ggv)

#### SO1 · Resultados do escritório e configuração (servidor)

Simulado nesta jornada: o Raio-X do acervo é uma referência fixa (979 processos, gerado em 21/09).

Percorrida em 08/10: passou, todos os passos à mão, exceto o 5 (P15). Os passos 6 e 7, e o que muda no passo 1, valem
depois que o #43 subir. Seguem os testes do #43 (`e2e/centrais-e-financeiro.e2e.ts:44`; `e2e/perfis.e2e.ts:33`;
`InicioDoSocio.test.tsx:47` e `:62`; `apps/api/src/rotas/processo.test.ts:209`), não percorridos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Topo → "Resultados" | Deferimento, procedência, extinções por causa e exigências no prazo, cada porcentagem com o número de casos e a data da base (G22); só totais, nunca cliente. (depois que o #43 subir) A tela inicial do Sócio já é "Resultados do escritório", com a busca e o chat em cima ("Êxito por benefício"); a fila aparece acima do painel só quando há tarefa dele (passo 4). "Honorários recebidos" e "Tempo até o dinheiro" contam pela confirmação do recebimento (FI1 passo 6) | GGVP-75, GGVP-78 |
| 2 | "Recorte" → Benefício → "Ver resultados" | O grupo pequeno também mostra a taxa, com os casos e a data | GGVP-75 |
| 3 | Topo → "Configuração" | Pode mudar limites, kits e mensagens | GGVP-104 |
| 4 | Depois de SE6 passo 8: Central → "(cliente) · Autorizar exportação do histórico" → "Autorizar a exportação" | "Exportação autorizada. Quem pediu já pode baixar o histórico."; quem pediu vê "Baixar o histórico (JSON)" | GGVP-99 (CA12) |
| 5 | Atribuir perfis a uma pessoa | Não há tela (P15) | GGVP-96 |
| 6 | (depois que o #43 subir) Topo → "Financeiro" | O mesmo painel do Financeiro (FI1 passo 9): os cartões, os gráficos e a tabela "Lançamentos", com a Vera Lúcia (exemplo) e os valores de cada cliente. Em "Prestações de contas pendentes", "Lançar" aparece só como etiqueta, sem abrir nada: quem lança é o Financeiro | GGVP-78, GGVP-96 |
| 7 | (depois que o #43 subir) Na busca, "Rita" → Enter → "Rita Exemplo" | A ficha abre só para ler. Sem o cartão "Dados bancários para o repasse". O caso do servidor também abre para ler, com os valores, sem o conteúdo médico e sem a petição | GGVP-96 |

---

## 7. Como foi conferido em 08/10 e em 09/10

### Em 09/10, de manhã: o que entra com o #43

- Sobre a branch do #43 (`juncao/entrega-0910`, em `c30d40c`), lida numa cópia separada do repositório. Esta
  atualização parte da `main`, não da junção; só documentação mudou.
- Li o corpo do #43 e dos quatro pedidos que ele junta (#25, #30, #37 e #42) e conferi no código da branch o que cada
  passo novo diz: as rotas e a tabela `ACESSO_DAS_TELAS` em `apps/web/src/App.tsx`, a matriz em
  `packages/contratos/src/permissoes.ts` (versão 22), o topo por perfil em `apps/web/src/componentes/itensDaGestao.ts`,
  os textos nos componentes de cada tela e o teste que prova o passo.
- **Nada disso rodou no GitHub:** a verificação do #43 (tipos, lint, testes, Playwright e varredura de segredos) espera
  a cobrança. O #43 diz o que rodou na máquina dele: typecheck, lint e testes focados. **Não houve passada no
  navegador.**

### Em 09/10, de madrugada

- Sobre a `main` em `ca01a8c` (mescla do #17), numa cópia separada do repositório. Só documentação mudou; nenhum código.
- Para cada pedido mesclado desde a versão anterior do roteiro (`git log 5905302..origin/main --merges`), li o corpo do
  pedido e conferi no código o que ele diz: a rota em `apps/web/src/App.tsx` (inclusive a tabela `ACESSO_DAS_TELAS`), o
  texto de cada tela citada no componente dela, e o teste de unidade, de servidor ou de navegador que prova o passo. Os
  problemas resolvidos foram conferidos no código e nos testes, nunca só pelo título do pedido.
- Os passos novos ou mudados (marcados "Conferida em 09/10") seguem os testes de navegador com login de verdade
  (`apps/web/e2e/`). **Não houve passada no navegador nesta atualização**, nem local nem na homologação.
- Testes: a última verificação completa da `main` no GitHub que passou (tipos, lint, testes, Playwright e varredura de
  segredos) é a da mescla do #23, às 06:36 (UTC) de 09/10. Os pedidos #28 e #17 passaram na verificação deles antes da
  mescla (06:40 e 06:37, UTC); a verificação da `main` depois deles não rodou: a do #28 foi cancelada pela do #17, e a
  do #17 não começou por causa da cobrança.
- A semente da homologação (`apps/api/src/banco/exemplo.ts`, usada por `homologacao:preparar`) não mudou os usuários
  desde 08/10. Entrou o caso da Lúcia Prado (exemplo), com o laudo esperando o parecer (AD3 passos 7 a 9). Os feriados
  não entram na semente: a Sênior carrega (SE6 passo 9).

### Em 08/10

- Portal local, com `pnpm dev` (API e telas), banco embutido com a semente de exemplo, na branch deste PR com a `main`
  mesclada (inclui a Recepção ligada no servidor, GGVP-125, e o Desfecho e financeiro, GGVP-11).
- Navegador automático (Playwright, Chromium), entrando pela tela "Entrar" com cada usuário de exemplo, com a senha lida
  na hora do arquivo de exemplo dos testes, nunca copiada. Relógio do navegador às 09:30 de 08/10, no fuso de São Paulo,
  como a manhã do teste.
- Cada jornada começa clicando na tarefa da Central, como o Lucas fará; quando não havia caminho por clique, o passo
  ficou registrado como problema e a tela foi aberta pelo endereço.
- Toda tarefa de cada Central (Atendimento, líder, Documentação, Advogada, Jurídico administrativo e Sênior) foi aberta
  uma a uma, para achar as que levam a "tela ainda não construída" (P1 a P5).
- A suíte de testes de tela do repositório (Playwright, 216 testes) rodou inteira na mesma base, depois da última mescla:
  216 passaram. Ela adianta o relógio quando precisa, por isso cobre passos que a passada à mão não alcança (P7).
- A passada à mão não mexe em nada: nenhum código mudou, nenhum cartão do Jira mudou.

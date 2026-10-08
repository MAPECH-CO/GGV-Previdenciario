# Roteiro do teste de aceite de 09/10 (GGVP-144)

Para o Lucas testar a homologação em 09/10/2026, de manhã até o fim do dia. Segue o caminho do escritório: do balcão ao
contrato, à documentação médica, ao INSS, à perícia, à Justiça e ao desfecho. Cada passo diz o que fazer, o que deve
aparecer e a história do Jira que ele prova.

O roteiro foi percorrido de verdade em 08/10, no portal local (`pnpm dev`, com a semente de exemplo), pelo navegador
automático, entrando com os usuários de exemplo e trocando de perfil como o Lucas vai fazer. O que não funcionou está na
seção "Problemas já encontrados", e não foi corrigido aqui. Depois da última mescla da `main` (Recepção ligada no
servidor, GGVP-125, e Desfecho e financeiro, GGVP-11), as jornadas da Recepção e do desfecho foram percorridas de novo.

## Sumário

1. Antes de começar: usuários, como entrar, o que é simulado, cuidados e o que é dado de saúde
2. Como registrar um problema no Jira
3. Plano de volta: voltar à versão anterior e quem chamar
4. Problemas já encontrados (os mais graves primeiro)
5. Ordem sugerida do dia
6. Jornadas por perfil: Atendimento, líder do Atendimento, Documentação, Advogada, Sênior, Jurídico administrativo,
   Financeiro e Sócio
7. Como foi conferido em 08/10

---

## 1. Antes de começar

### Usuários de teste

Só e-mail e perfil. As senhas provisórias chegam pelo Mateus, por fora do repositório, do Jira e do chat. No primeiro
acesso, cada usuário pede para trocar a senha (GGVP-117); troque e guarde a nova.

| E-mail | Perfil | Para que serve no teste |
|---|---|---|
| atendimento@exemplo.ggv | Atendimento | balcão, agenda, contrato, cobrança, relacionamento |
| lider@exemplo.ggv | Atendimento · líder e Atendimento | trocar de perfil, tarefas do setor |
| documentacao@exemplo.ggv | Documentação | conferir documentos, checklist, liberar, exigências |
| advogada@exemplo.ggv | Advogada responsável | entrevista, parecer médico, INSS, petição, perícia |
| senior@exemplo.ggv | Sênior | conferência antes do INSS, despacho, vigília, gestão |
| senior2@exemplo.ggv | Sênior (a segunda) | aprovar a dispensa do parecer, que pede duas sêniores |
| juridico@exemplo.ggv | Jurídico administrativo | protocolo no Meu INSS, perícia |
| financeiro@exemplo.ggv | Financeiro | receber a prestação de contas, totais em dinheiro |
| socio@exemplo.ggv | Sócio | resultados do escritório, configuração |
| provisoria@exemplo.ggv | Atendimento | testar a troca obrigatória da senha |
| semperfil@exemplo.ggv | nenhum | testar o aviso "sem perfil" |
| trava@exemplo.ggv | Atendimento | testar a trava depois de 5 senhas erradas |

### Como entrar e trocar de perfil

- Entre pelo endereço da homologação (o Mateus manda junto com as senhas). A tela pede e-mail e senha.
- Para trocar de perfil: botão **Sair**, no topo, e entre com o próximo e-mail. **Faça isso na mesma aba do
  navegador.** Algumas telas ainda guardam o que você fez na própria aba (ver "O que ainda é simulado"); aba nova ou
  janela nova começa do zero nessas telas.
- O líder tem dois perfis: o nome do perfil no topo ("Atendimento · líder ⌄") abre "Entrar como…" e troca a Central
  sem sair.

### O que ainda é simulado (vale para o dia todo)

Em linguagem simples, antes de cada jornada o roteiro repete o que vale para ela:

- **A IA nas telas do Pedro é de mentira.** Leitura de documento, resumo de laudo, sugestão de benefício, parecer
  sugerido, orientação da perícia, resumo da conversa: tudo sai de textos de exemplo prontos, sempre iguais. Serve para
  testar o caminho e as travas, não a qualidade da IA. A IA de verdade vem nas GGVP-133, 134, 139, 140 e 142.
- **A transcrição é de mentira.** A gravação acontece, mas o texto transcrito é sempre o mesmo diálogo de exemplo, mesmo
  quando não combina com o cliente (GGVP-133).
- **O Chatwoot é de mentira.** "Enviar pelo Chatwoot" e "Lembrar pelo WhatsApp" mostram a mensagem e registram no
  histórico, mas nada sai para o cliente.
- **O ZapSign é de mentira.** O link de assinatura é de exemplo; o retorno "assinado" vem do botão "Simular o retorno do
  ZapSign".
- **Scanner e impressora são de mentira.** "Digitalizar (scanner simulado)" e "Imprimir" só fingem.
- **Algumas telas ainda guardam no navegador, não no servidor.** É o caso das pessoas de exemplo da Recepção e da
  Abertura (Josefa, Natália, Antônio, Cleide, Nair, Rita, Marta, Sebastião, Pedro Exemplo, Maria Exemplo, Lúcia Exemplo,
  Davi), da documentação médica, da Perícia e do Relacionamento. O que você faz nelas fica só nessa aba: outra pessoa, em
  outro computador, não vê. Elas serão ligadas ao servidor nas GGVP-125 (em andamento), 132, 137 e 138.
- **O que já grava no servidor:** o lead novo criado no balcão, a agenda e a entrevista dele (GGVP-125), toda a via
  administrativa no INSS, a Justiça (petição, vigília, exigência do juiz), o desfecho (prestação de contas, ida ao banco
  e o resultado explicado ao cliente), o cofre do gov.br, a gestão e os resultados. Isso qualquer perfil vê, em qualquer computador.
- **Nomes misturados.** As telas do navegador chamam a advogada de "Dra. Paula" e a Documentação de "Jéssica"; os
  usuários de exemplo do servidor são "Gabi (exemplo)" e "Fábio (exemplo)". É a mesma pessoa de teste.

### Cuidados com o relógio e com os casos de exemplo

- **A entrevista da Josefa é "hoje às 15:30".** Faça a jornada da Josefa antes das 15:30; depois desse horário a
  pendência "Preencher ficha" some, porque a hora da entrevista já passou.
- **As perícias de exemplo ficam 9 dias à frente.** Confirmar presença e registrar o comparecimento só liberam na
  véspera e depois da data; por isso o resultado da perícia não dá para testar em 09/10 (problema P7).
- **Cada caso de exemplo do servidor só passa uma vez.** O que você aprova, protocola ou decide fica gravado na
  homologação. Se precisar repetir, peça ao Mateus para recriar o banco da homologação (isso gera senhas novas).

### Dado de saúde: o que é e quem vê (regra do Pedro, 08/10)

- **Dado de saúde é só o conteúdo médico:** o laudo, o CID, o diagnóstico, o parecer médico e o texto dos documentos
  médicos. Só o Jurídico vê.
- **Status, datas e etapas não são dado de saúde:** documento recebido, laudo ok ou pendente, perícia marcada, feita,
  favorável ou não, e o que a própria pessoa registrou. O Atendimento e a Documentação veem normalmente (Lucas, 02/10).
  Isso não é problema; não registre como Bug.
- O portal não filtra frases ou palavras de saúde em texto livre, de propósito. Também não é problema.

### Publicação durante o teste

- **Nada entra na `main` durante o teste sem avisar.** Cada mescla na `main` publica sozinha na homologação em até 10
  minutos e pode trocar a tela no meio de uma jornada.

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
   lista de deploys e volte ao último deploy que estava bom (Rollback, ou novo deploy daquele commit). Confira
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

Encontrados na passada de 08/10. Não foram corrigidos aqui. Perfil, passo e o que aconteceu.

### Graves: a jornada não segue pela tela, ou não dá para testar amanhã

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P1 | Jurídico administrativo | JA3: abrir "Marcar perícia médica" que nasce quando a advogada decide a perícia (caso Antônia Lima, servidor) | Abre "Esta tela ainda não foi construída". A perícia aberta pelo servidor não chega à tela de marcar perícia, que ainda é do navegador. | GGVP-31, GGVP-49, GGVP-137 |
| P2 | Atendimento | SE1 → AT9: abrir "Benedito Alves · Ajustar o caso" depois que a Sênior reprova | Abre "Esta tela ainda não foi construída". | GGVP-23, GGVP-127 |
| P3 | Atendimento | AT7: abrir "Vera Lúcia (exemplo) · Levar ao banco", que nasce quando o Financeiro marca a ida ao banco | Abre "Esta tela ainda não foi construída". O Atendimento não vê a data, o local nem quem leva. (O Financeiro marca e confirma pela tela dele, que funciona.) | GGVP-98, GGVP-44 |
| P4 | Atendimento, líder e Documentação | Central: "Marta · Agendar ida ao banco", "Antônio · Cumprir exigência do juiz", "Pedro · Responder a exigência do INSS", "Lúcia · Avisar a cliente do resultado" | As quatro abrem "Esta tela ainda não foi construída". São tarefas de exemplo do navegador; nos casos do servidor, a exigência do juiz (Paulo Reis) e a exigência do INSS (Ulisses) funcionam; a ida ao banco agora é marcada pelo Financeiro (FI1). | GGVP-78 (CA3), GGVP-44, GGVP-83, GGVP-39, GGVP-98 |
| P5 | Advogada | Central: "Lúcia Exemplo · Prestação de contas: dar o OK" | Abre "Esta tela ainda não foi construída". | GGVP-92 (ainda em "Refinada") |
| P6 | Todos com Central (Atendimento, líder, Advogada, Jurídico administrativo) | Aba "Tarefas do setor" | Mostra "Tarefas do setor: tela ainda não construída." O líder não vê nem atribui as tarefas do setor. | GGVP-78 (CA12), GGVP-115 |
| P7 | Jurídico administrativo e Advogada | JA2: confirmar presença, registrar comparecimento e conferir o resultado da perícia | Não dá para testar em 09/10: as perícias de exemplo ficam 9 dias à frente, e "Registrar" só libera depois da data. "Conferir resultado da perícia" nunca chega à Central da advogada. Os testes automáticos cobrem com o relógio adiantado. | GGVP-66, GGVP-70 |

### Médios: segue, mas falta algo que o critério pede

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P8 | Sênior | SE4: "Despachar caso" do indeferido | A tela mostra o motivo e a carta, mas não traz a análise da IA nem sugestão de despacho. | GGVP-54 |
| P9 | Advogada | AD5: "Pedir a petição" | O texto da versão 1 vem vazio: a IA não escreve a petição; a advogada precisa colar o texto. | GGVP-63 |
| P10 | Advogada | AD8: "Paulo Mendes · Aprovar o resumo para o cliente" | O texto do resumo vem vazio: a IA não escreve o rascunho; a advogada escreve do zero. O resto funciona (aprovar, passar ao Atendimento, explicar, "Perdemos: estudo registrado"). | GGVP-22 (CA3) |
| P11 | Sênior, Financeiro e Sócio | Tela inicial | Sem a caixa de conversa "Pergunte ou peça" e sem a busca. Financeiro e Sócio veem "Nada na sua fila agora", sem o atalho para buscar cliente. | GGVP-78 (CA4, CA6, CA9), GGVP-82 |
| P12 | Sênior | SE2: pedir a dispensa do parecer da Rita | Nenhuma tarefa da Rita chega à Central da Sênior. O link "Dispensar o parecer" fica na tela do parecer, que a Sênior só abre pelo endereço. | GGVP-33 |
| P13 | Advogada e Sênior | AD3: linha do tempo da deficiência (Cleide, PCD) e roteiros de conteúdo mínimo | A linha do tempo não tem caminho por clique (nem pela ficha, nem pela página do caso). Os roteiros só abrem pelo "ver o roteiro" da tela do parecer; a Sênior não tem link para editar. O "Histórico do processo" só tem link na vigília do Meu INSS do caso, que a Sênior não alcança por clique. | GGVP-42, GGVP-93, GGVP-99, GGVP-135 |
| P14 | líder do Atendimento | LI1: topo da tela | O topo não mostra a Gestão (Prazos, Tentativas bloqueadas, Resultados), embora o perfil tenha a permissão de ver. | GGVP-96, GGVP-78 |
| P15 | Sócio | SO1: atribuir perfis a uma pessoa | Não há tela para isso; hoje só pelo comando no servidor. | GGVP-96 |
| P16 | Sênior, Sócio e Financeiro | SE6: Configuração, kit por benefício | O kit mostra códigos ("cadunico", "comprovante_de_residencia", "Tirar declaracao_de_moradia") em vez dos nomes, e "Versão 1, desde 31/12/1999, 22:00". | GGVP-104 |
| P17 | Atendimento, Documentação, Advogada, Sênior | Prazos do INSS e da Justiça | A tela avisa "Feriados não cadastrados: por enquanto o prazo só pula sábado e domingo". O lado seguro (G12) vale só para fim de semana. | GGVP-34, GGVP-39 |
| P18 | Jurídico administrativo | JA2: chat "Perícias para marcar" | Responde "Nenhuma perícia espera marcação agora" mesmo com a perícia da Antônia (servidor) aberta. | GGVP-49, GGVP-82 |

### Leves: texto e aparência

| # | Perfil | Passo | O que aconteceu | História |
|---|---|---|---|---|
| P19 | Advogada e Sênior | Histórico do processo | Rótulos sem acento: "Pendencia cumprida", "Peticao versao nova", "Peticao versao apos aprovacao". | GGVP-99 |
| P20 | Todos | Telas do navegador | Nomes de exemplo misturados: "Dra. Paula" e "Jéssica" nas telas do navegador; "Gabi (exemplo)" e "Fábio (exemplo)" no servidor. | GGVP-125 |
| P21 | Advogada | AD2: transcrição e definir benefício da Josefa | A transcrição simulada é sempre a mesma (incapacidade, auxiliar de limpeza), e a IA sugere Auxílio por Incapacidade Temporária para uma lead de LOAS Idoso. | GGVP-46, GGVP-51, GGVP-133 |

---

## 5. Ordem sugerida do dia

As jornadas passam a vez de um perfil para outro. Esta ordem evita esperar por um passo que outro perfil ainda não fez.

| Quando | Jornadas |
|---|---|
| Começo (09:00) | ENT (entrar), AT1 (lead novo) → AD1 (entrevista do lead novo) → LI1 (líder vê o lead) |
| Manhã, antes das 15:30 | AT2 (agenda e Josefa) → AD2 (benefício e fechamento) → AT3 (documento e laudo) → AT4 (contrato) |
| Manhã | DO1, DO2 (documentos e checklist) → AD3 (parecer médico) → AT5 (cobrança e pedido ao médico) → SE2 (dispensa) → DO3 (liberar) |
| Depois do almoço | SE1 (conferência) → JA1 (protocolo) → AD4 (INSS) → DO4 (exigência do INSS) → SE3 (cobrança no limite) → FI1 (Financeiro) → AT7 (banco) → FI1 passo 6 |
| Tarde | SE4 (despacho) → AT8 e DO5 (pendências) → AD5 (petição e Justiça) → SE5 (vigília e acervo) |
| Tarde | JA2 (perícia) → DO6 (documentos da perícia) → AD6 (página da perícia) |
| Fim | AD8 (resumo do resultado) → AT10 (explicar ao cliente), AT6 (relacionamento), AT9 (chat e limites), AD7 (chat e caso), SE6 (gestão) → SO1 (Sócio) |

---

## 6. Jornadas por perfil

Cada passo: o que fazer, o resultado esperado e a história que ele prova. "Percorrida em 08/10" diz como foi a passada.

### Entrar (todos os perfis) · ENT

Simulado nesta jornada: nada; o login é de verdade, no servidor.

Percorrida em 08/10: passou. À mão: passos 4 e 5. Só nos testes automáticos (que passaram): 1 a 3.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Abra o endereço da homologação sem estar logado | Vai para a tela "Entrar" | GGVP-117 |
| 2 | Entre com provisoria@exemplo.ggv e a senha recebida | Pede para trocar a senha antes de entrar; depois da troca, abre a Central do Atendimento | GGVP-117 |
| 3 | Saia; entre com trava@exemplo.ggv e erre a senha 5 vezes; tente a certa | Mensagem única que não diz qual campo errou; na 5ª, trava por 15 minutos, mesmo com a senha certa | GGVP-117 |
| 4 | Entre com semperfil@exemplo.ggv | "Sem perfil, fale com a gestão." e nenhuma tela de caso | GGVP-117, GGVP-96 |
| 5 | Entre com cada perfil e veja a tela inicial | Cada perfil cai na sua Central: Atendimento, Advogada, Jurídico administrativo, Sênior, Financeiro e Sócio têm Central própria; a Documentação usa a Central do Atendimento | GGVP-78, GGVP-96 |

### Atendimento (atendimento@exemplo.ggv)

#### AT1 · Lead novo no balcão, até a entrevista marcada (servidor)

Simulado nesta jornada: o convite pelo Chatwoot não sai de verdade; a pasta do Drive é de exemplo. O lead, a agenda e a
confirmação já gravam no servidor.

Percorrida em 08/10: passou; o lead novo apareceu para o líder em outro navegador, com a entrevista na agenda. À mão: passos 1 e 3 a 7. Só nos testes automáticos: 2 e 8.

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

Percorrida em 08/10: passou. À mão: passos 1, 3, 4 e 5. Só nos testes automáticos: 2.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Balcão: busque Antônio → "Entregar documento" → "Encaminhar" → "Abrir a tarefa" | Abre "Antônio Exemplo · Receber documento"; "Registrar" desligado | GGVP-17 |
| 2 | "Papel — vai ao scanner" → "Digitalizar (scanner simulado)" → marque as duas conferências → "Registrar" | O lote lido aparece com o aviso de conferir o papel; "Registrado às …"; a tarefa sai da Central | GGVP-17 (CA1, CA2, CA5, CA10) |
| 3 | Na ficha do Antônio, solte um PDF de laudo → "Enviar para a pasta do cliente" | Entra como "Laudo novo", aguardando o Jurídico: esse status o Atendimento vê; o conteúdo do laudo, não | GGVP-17 (CA6, CA9) |
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

#### AT6 · Relacionamento com o cliente (navegador)

Simulado nesta jornada: Chatwoot, a transcrição e o resumo da IA do que mudou.

Percorrida em 08/10: passou. À mão: passos 1, 4, 5, 6 e 8. Só nos testes automáticos: 2, 3 e 7.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Pedro Exemplo · Registrar conversa" → suba o áudio da ligação → confirme o aviso de gravação → "Anexar e transcrever" | "Gravação da ligação anexada"; transcreve; "Anexar" só libera com o aviso confirmado (G10) | GGVP-76 (CA2, CA8), GGVP-80 |
| 2 | Na mesma tarefa: "Conferir e atualizar" → confirme, corrija ou desfaça campo por campo | O valor antigo fica no histórico; "Desfazer" volta; a tarefa sai da Central ao confirmar | GGVP-84, GGVP-80 (CA4) |
| 3 | Ficha da Maria → "Iniciar conversa" → Presencial → gravar | Só presencial e telefone; a gravação começa com o aviso (G10); a senha dita não entra na transcrição (G9) | GGVP-76 |
| 4 | Ficha da Maria → "Mensagem ao cliente" → modelo de orientação da perícia → "Enviar pelo Chatwoot" | Sai com o status no card; a mensagem termina dizendo que o escritório nunca pede a senha do gov.br | GGVP-102, GGVP-111 (CA4) |
| 5 | Ficha do Antônio → "Mensagem ao cliente" → resultado favorável | "Enviar" fica desligado: o aviso só sai depois do OK da advogada (G8) | GGVP-102 (CA7), G8 |
| 6 | Ficha do Antônio: mude o telefone → "Salvar alterações" | Pede como confirmou que é o cliente (vídeo ou escritório) e o contrato novo; o antigo e o novo ficam no histórico | GGVP-111 (CA1) |
| 7 | Ficha da Lúcia → "Mudar dados bancários" → "Pedir a mudança"; outra pessoa confirma | Muda só com a segunda pessoa; o contato anterior é avisado; a advogada recebe o alerta | GGVP-111 (CA2, CA5) |
| 8 | Ficha do Antônio → "+ Nova demanda" → "Outro pedido" → benefício → "Abrir a nova demanda" | A demanda abre na mesma ficha e leva a marcar a entrevista | GGVP-124 |

#### AT7 · Levar o cliente ao banco (servidor; depois de FI1 passo 5)

Simulado nesta jornada: nada; grava no servidor. Desde 08/10 quem avisa o cliente e marca a ida ao banco é o Financeiro
(GGVP-98); o Atendimento só leva.

Percorrida em 08/10, à mão: falhou no passo 1 (P3).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Vera Lúcia (exemplo) · Levar ao banco" | Deveria abrir a visita com a data, o local e quem leva, sem nenhum valor em R$; hoje abre "tela ainda não construída" (P3) | GGVP-98, GGVP-44 |

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

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | No chat: "Qual o valor da prestação de contas da Lúcia Exemplo?" | "não tem acesso a esse valor"; nenhum R$ na tela | GGVP-82 (CA2), GGVP-96 |
| 2 | No chat: "Protocola o pedido da Nair Exemplo no INSS" | Recusa citando o portão G2 | GGVP-82 (CA4), GGVP-109 |
| 3 | No chat: "Faz a petição do BPC da Rita Exemplo." | "Fora do seu perfil"; oferece criar a tarefa para a advogada | GGVP-82 (CA8) |
| 4 | Depois de SE1 passo 2: Central → "Benedito Alves (exemplo) · Ajustar o caso" | Deveria abrir o caso para ajustar; hoje abre "tela ainda não construída" (P2) | GGVP-23, GGVP-127 |
| 5 | Central: "Marta · Agendar ida ao banco" e as outras três de P4 | Deveriam abrir o passo; hoje abrem "tela ainda não construída" (P4) | GGVP-78 (CA3) |
| 6 | Abra a página do caso do Antônio (pela ficha → pasta do processo) | Vê o caso numa linha, com status, datas e etapas (documento recebido, laudo ok ou pendente, perícia marcada); sem petição, estratégia, valores nem conteúdo médico | GGVP-86, GGVP-96 |
| 7 | Tente abrir o endereço de protocolo de um caso (peça o link à advogada) | "Sem permissão" | GGVP-96 (CA11) |

#### AT10 · Explicar o resultado ao cliente (servidor; depois de AD8)

Simulado nesta jornada: nada; grava no servidor.

Percorrida em 08/10: passou, todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Paulo Mendes (exemplo) · Explicar resultado" | O resumo aprovado pelo Jurídico, com o nome de quem aprovou; nada de estratégia interna | GGVP-22 (CA1, CA3) |
| 2 | "Sem contato, tentar de novo" | "Tentativa registrada. A tarefa continua aberta." | GGVP-22 (CA4) |
| 3 | Canal e o que foi explicado → "Expliquei ao cliente" | "Explicação registrada. Caso encerrado."; o caso fica "Perdemos: estudo registrado"; os contatos ficam com data e canal | GGVP-22 (CA2, CA4), GGVP-19 |

### Líder do Atendimento (lider@exemplo.ggv)

#### LI1 · Trocar de perfil, tarefas do setor e o lead visto em outro computador

Simulado nesta jornada: as tarefas de exemplo do navegador.

Percorrida em 08/10, à mão: o passo 2 passou; o 3 falhou (P6) e o 4 (P14). O passo 1 passou nos testes automáticos.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Clique em "Atendimento · líder ⌄" no topo | "Entrar como…" mostra só os dois perfis da pessoa; escolher "Atendimento" troca a Central | GGVP-96 (CA10) |
| 2 | Num computador ou navegador diferente do de AT1, busque no balcão o lead novo criado em AT1 e abra a agenda | O lead aparece na busca; a entrevista está na agenda | GGVP-125 |
| 3 | Aba "Tarefas do setor" | Deveria listar as tarefas do setor, as sem responsável primeiro, e deixar atribuir; hoje mostra "tela ainda não construída" (P6) | GGVP-78 (CA12) |
| 4 | Procure no topo Prazos, Tentativas bloqueadas e Resultados | Hoje não aparecem para o líder (P14) | GGVP-96 |

### Documentação (documentacao@exemplo.ggv)

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

Simulado nesta jornada: a transcrição (sempre o mesmo diálogo) e o roteiro marcado pela IA.

Percorrida em 08/10: passou, todos os passos à mão, com a advogada em outro navegador.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "(lead de AT1) · Preparar entrevista" | Resumo da ficha, pontos de atenção, a anotação do primeiro contato | GGVP-32 |
| 2 | "Analisar a ficha" → "Não" (não é acidentário) → "Confirmar" | "Análise registrada"; sem senha do gov.br, o Atendimento recebe "Renovar senha do gov.br" | GGVP-32, GGVP-36 |
| 3 | "Voltar à preparação" → "Iniciar entrevista (Transcrição)" → "Gravar" | "Começar a gravar" só libera depois do aviso de gravação ao cliente (G10) | GGVP-40 |
| 4 | Converse 2 minutos → "Encerrar e gerar resumo" | "Entrevista encerrada"; o áudio fica guardado; a transcrição fica pronta | GGVP-40, GGVP-46 |
| 5 | Em outro navegador, entre de novo como advogada | "Definir benefício" e "Cadastrar lead" do lead estão na Central | GGVP-125 |
| 6 | Como Atendimento, abra a ficha do lead | Vê o histórico, o status e as etapas; não abre a entrevista nem a transcrição, que são do Jurídico | GGVP-46 (CA4), GGVP-96 |

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

Simulado nesta jornada: tudo o que a IA lê, resume e sugere no parecer.

Percorrida em 08/10: passou, exceto o passo 5 (P13). À mão: passos 1 a 5. Só nos testes automáticos: 6.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Rita Exemplo · Dar parecer médico" | O roteiro do benefício item por item, com o trecho do documento; "A IA sugere Insuficiente"; "Registrar parecer" só libera com cada item conferido | GGVP-20, GGVP-93 |
| 2 | Confira cada item → "Insuficiente — pedir complemento" → ajuste o que o documento deve abordar → "Registrar parecer" | O pedido ao médico vai para o Atendimento (AT5); o texto não sugere diagnóstico, CID, grau nem conclusão (G20) | GGVP-20, GGVP-29 |
| 3 | Central: "Antônio Exemplo · Analisar laudo novo" → "Ir para o parecer" → "Suficiente — liberar" → "Registrar parecer" | Resumo e comparação com o laudo anterior; o parecer refeito fica no histórico; a ficha deixa de mostrar "Laudo novo" | GGVP-20 (CA6, CA7) |
| 4 | Central: "Davi Exemplo · Dar parecer médico" | Usa o roteiro infantil; a condição e as terapias pedem os relatórios por condição | GGVP-50 |
| 5 | Linha do tempo da deficiência da Cleide (PCD) | Hoje não há caminho por clique (P13); pelo endereço `/casos/cleide-exemplo-1/deficiencia`, mostra os períodos com e sem deficiência e o enquadramento | GGVP-42 |
| 6 | No parecer, "ver o roteiro" | A advogada vê o roteiro sem editar | GGVP-93 (CA1) |

#### AD4 · Via administrativa no INSS (servidor; depois de SE1)

Simulado nesta jornada: nada; grava no servidor. A vigília do Meu INSS é manual (a advogada traz a resposta).

Percorrida em 08/10: passou. À mão: passos 1 e 3 a 8. Só nos testes automáticos: 2.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Antônia Lima (exemplo) · Decidir perícia" → "Sim, o sistema abre a tarefa de perícia" → "Perícia médica" → "Definir" | "O sistema abriu a tarefa de perícia para o Jurídico administrativo" (ver JA3 e P1) | GGVP-31 |
| 2 | Central: "Rita Gomes (exemplo) · Trazer a resposta do INSS" → "Deferido" → texto → "Registrar" sem anexo | Recusa: "Anexe a comunicação do INSS" | GGVP-35 |
| 3 | Anexe a comunicação → "Registrar" | "O sistema abriu Prestar contas"; o passo seguinte aparece na mesma tela | GGVP-35, GGVP-44 |
| 4 | Central: "Ulisses Rocha (exemplo) · Tratar exigência do INSS" → "Documentos", prazo 30 dias, itens, prazo da Documentação → "Criar a tarefa" | Prazo do INSS contado pelo sistema (G12); "A Documentação recebeu o card" (DO4) | GGVP-39 |
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
| 7 | Prazo 15 → "Classificar" | Prazo contado pelo lado seguro (G12, sem feriados: P17); abre "Analisar exigência do juiz" | GGVP-34, GGVP-37 |
| 8 | Central: "Paulo Reis (exemplo) · Analisar exigência do juiz" → "Precisa cumprir" → item para a Documentação e para o Atendimento → "Confirmar" | Cada setor recebe "Cumprir exigência do juiz"; "Falta: Atendimento, Documentação." | GGVP-79, G5 |
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

Percorrida em 08/10: passou. À mão: passos 1, 2, 4 e 5. Só nos testes automáticos: 3.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | No chat: "O que falta no caso do Antônio Exemplo?" | Diz a fase e a próxima ação, com o link para o caso | GGVP-82 (CA1, CA3) |
| 2 | No chat: "Cria uma tarefa para a Documentação cobrar o laudo que falta do Antônio Exemplo até amanhã" → escolha → "Trocar" o responsável → "Confirmar e criar a tarefa" | Nada acontece antes de confirmar; "Feito: tarefa criada para …"; a ação aparece no caso como "feito pelo chat" | GGVP-82 (CA5, CA7, CA9), GGVP-106 |
| 3 | No chat: peça para liberar a Rita sem o parecer | Recusa e diz o portão que falta (G17) | GGVP-33 (CA3), GGVP-109 |
| 4 | Página do processo do Antônio | O caso numa linha: fases, quem espera quem, tarefas em andamento com responsável, dados do processo; histórico | GGVP-86 |
| 5 | Página do processo do Pedro → "✦ Suporte" → "O que falta aqui?" | Responde sobre o caso; a jurimetria vem do sistema | GGVP-82 (CA6, CA10) |

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

Percorrida em 08/10: passou. O ajuste que volta ao Atendimento não abre (P2). À mão: passos 1 a 3 (a recusa sem motivo, só nos testes automáticos).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Antônia Lima (exemplo) · Conferir antes do INSS" → vê "Suficiente" → "Aprovar" | "Aprovado. O protocolo e a decisão de perícia foram abertos." (JA1 e AD4) | GGVP-23, G2 |
| 2 | Central: "Benedito Alves (exemplo) · Conferir antes do INSS" | "Aprovar" desligado (sem parecer, G17) | GGVP-23, GGVP-33 |
| 3 | "Reprovar, volta ao Atendimento" → "Confirmar reprovação" sem motivo; depois com motivo | Sem motivo: "Escreva o que o Atendimento precisa ajustar"; com motivo: "O caso voltou para o Atendimento ajustar" | GGVP-23 |

#### SE2 · Dispensa do parecer, com duas sêniores (navegador; depois de AD3)

Simulado nesta jornada: o parecer da IA.

Percorrida em 08/10: passou pelo endereço; não há caminho por clique para a primeira sênior (P12). Todos os passos à mão.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Procure na Central uma tarefa da Rita | Não há (P12); o link "Dispensar o parecer" está na tela do parecer da Rita | GGVP-33 |
| 2 | Abra a dispensa (`/casos/rita-exemplo-1/parecer/dispensa`) → justificativa → "Pedir a dispensa (1ª sênior)" | Fica esperando a segunda sênior | GGVP-33 (CA1, CA2) |
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

Percorrida em 08/10: passou, com P16. À mão: passos 1, 3 a 6 e 8. Só nos testes automáticos: 2 e 7.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Topo → "Configuração" → mude "Cliente sumido: dias…" para 12 → salvar | "Parâmetro salvo."; fica no histórico da configuração | GGVP-104 |
| 2 | Escolha um benefício → acrescente um documento ao kit → "Publicar a versão" | "Kit publicado: a versão nova vale para os casos novos." Hoje o kit mostra códigos e uma data errada (P16) | GGVP-104 |
| 3 | Topo → "Tentativas bloqueadas" | Quem tentou passar por um portão, com perfil, caso e ação | GGVP-109 |
| 4 | Topo → "Uso do cofre" | Quem leu, cadastrou ou trocou a senha do gov.br; a senha nunca aparece | GGVP-103 |
| 5 | Topo → "Prazos" | Prazos cumpridos e perdidos | GGVP-94, GGVP-68 |
| 6 | Topo → "Resultados" | Indicadores com o número de casos e a data da base (G22); sem os totais em R$ | GGVP-75 |
| 7 | Roteiro de conteúdo mínimo do LOAS Deficiente: editar um item e salvar | Salva a versão 2. Hoje só pelo endereço `/roteiros` (P13) | GGVP-93 |
| 8 | "Histórico do processo" de um caso (o link está na vigília do Meu INSS do caso; a Sênior só chega pelo endereço, P13) → motivo → "Pedir a exportação" | "Pedido enviado. A direção recebeu a tarefa de autorizar a exportação." | GGVP-99 (CA12) |

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

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central: "Maria Exemplo · Marcar perícia" → "Não, tentar de novo" → dia e o que aconteceu → "Registrar a tentativa" | "Tentativa registrada: a tarefa continua com você e volta amanhã." | GGVP-53 (CA1) |
| 2 | "Sim, marcado" → comprovante do INSS → confira o que foi lido → "Sim: atribuir à Documentação" → "Registrar a perícia" | "Perícia registrada"; vai para a agenda e a ficha; a Documentação recebe "Reunir documentos da perícia" (DO6) | GGVP-53 (CA2 a CA4), GGVP-56 |
| 3 | No chat, "Perícias para marcar" | Lista o que espera marcação. Hoje ignora a perícia que nasceu no servidor (P18) | GGVP-49 |
| 4 | Central: "Antônio Exemplo · Orientar para a perícia" → revise → "Revisei a orientação" → "Enviar orientação" | Texto que proíbe esconder a situação não sai (G11); enviado, a tarefa sai da Central | GGVP-62, GGVP-61 |
| 5 | Página da perícia do Antônio → "Confirmar presença" | Mostra "A confirmação entra na sua Central na véspera"; "Registrar" só depois da data (P7) | GGVP-66 |
| 6 | Página do processo do Pedro → "Identificar o perito" em um clique | O perito fica ligado; a orientação passa a ser pelo perfil dele | GGVP-73, GGVP-61 (CA5, CA6) |

#### JA3 · Perícia aberta pelo servidor (depois de AD4 passo 1)

Percorrida em 08/10, à mão: falhou no passo 2 (P1).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Central | "Antônia Lima (exemplo) · Marcar perícia médica" aparece sozinha, sem ninguém criar | GGVP-31, GGVP-49 |
| 2 | Clique na tarefa | Deveria abrir "Marcar perícia"; hoje abre "tela ainda não construída" (P1) | GGVP-49, GGVP-137 |

### Financeiro (financeiro@exemplo.ggv)

#### FI1 · Receber a prestação, avisar o cliente e marcar a ida ao banco (servidor; depois de AD4 passo 6)

Simulado nesta jornada: o aviso ao cliente não sai de verdade (o Financeiro revisa a mensagem e marca "Revisei e
enviei").

Percorrida em 08/10: passou, todos os passos à mão, depois da mescla do Desfecho e financeiro. A Central fica vazia até a
advogada concluir uma prestação.

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Entre antes de AD4 passo 6 | "Nada na sua fila agora." (sem chat nem busca: P11) | GGVP-78 |
| 2 | Depois de AD4 passo 6: "Vera Lúcia (exemplo) · Receber a prestação de contas" | Repasse ao cliente R$ 8.641,97; "Receber e lançar" desligado até marcar "Valores conferem com o comprovante" | GGVP-44, GGVP-98 |
| 3 | Marque a conferência → "Receber e lançar" | "Recebimento lançado. Agora avise o cliente e marque a ida ao banco." | GGVP-98 |
| 4 | Central: "Vera Lúcia · Avisar resultado e agendar a ida ao banco" → data, hora, agência, quem do Atendimento leva → "Agendar" | Mensagem pronta: "Seu benefício foi concedido. A ida ao banco está marcada para … Ana (exemplo), do escritório, vai com você." | GGVP-98, GGVP-44 |
| 5 | Revise e "Revisei e enviei" | O aviso fica registrado com o canal e quem enviou; o Atendimento recebe "Levar ao banco" (AT7) | GGVP-98, G8 |
| 6 | Depois da ida ao banco: na mesma tela, "Confirmar recebimento" | "Recebimento confirmado. Caso encerrado." | GGVP-98 |
| 7 | Topo → "Resultados" | Os totais em dinheiro do escritório (honorários recebidos, tempo até o dinheiro) | GGVP-75 |
| 8 | Topo → "Configuração" | Só leitura: sem botões de salvar ou publicar | GGVP-104 |

### Sócio (socio@exemplo.ggv)

#### SO1 · Resultados do escritório e configuração (servidor)

Simulado nesta jornada: o Raio-X do acervo é uma referência fixa (979 processos, gerado em 21/09).

Percorrida em 08/10: passou, todos os passos à mão, exceto o 5 (P15).

| # | Passo | Resultado esperado | História |
|---|---|---|---|
| 1 | Topo → "Resultados" | Deferimento, procedência, extinções por causa e exigências no prazo, cada porcentagem com o número de casos e a data da base (G22); só totais, nunca cliente | GGVP-75 |
| 2 | "Recorte" → Benefício → "Ver resultados" | O grupo pequeno também mostra a taxa, com os casos e a data | GGVP-75 |
| 3 | Topo → "Configuração" | Pode mudar limites, kits e mensagens | GGVP-104 |
| 4 | Depois de SE6 passo 8: Central → "(cliente) · Autorizar exportação do histórico" → "Autorizar a exportação" | "Exportação autorizada. Quem pediu já pode baixar o histórico."; quem pediu vê "Baixar o histórico (JSON)" | GGVP-99 (CA12) |
| 5 | Atribuir perfis a uma pessoa | Não há tela (P15) | GGVP-96 |

---

## 7. Como foi conferido em 08/10

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

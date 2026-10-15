# A história do sistema: a Dona Maria do balcão ao dinheiro

Esta é a definição de pronto do portal. A [definição de pronto da história](definition-of-done.md) diz quando uma história
está feita. Esta diz quando o portal inteiro está pronto: quando a Dona Maria vai do balcão ao dinheiro no servidor de
verdade, e cada passo é feito pelo perfil certo, com o próprio login.

Os cartões de fechamento de 11/10 (GGVP-158 e GGVP-159) mediram o portal por esta história, mas o texto dela não ficou
escrito. Este é o texto, de 15/10 (GGVP-158, parte 10). Ele só junta o que já estava decidido, com a fonte de cada regra:

- os [perfis](../requisitos/perfis.md);
- os [portões](../requisitos/portoes-governanca.md);
- o [BPMN](../bpmn/README.md);
- o [roteiro do teste](../entrega/roteiro-do-teste-09-10.md);
- as respostas do Lucas nos cartões.

Decisão nova não entra aqui: muda primeiro no cartão do Jira, depois neste texto. A Dona Maria é inventada, como todo
dado de teste.

## Quando o portal está pronto

1. Todos os passos abaixo acontecem na homologação, no servidor de verdade, cada um com o login do perfil indicado.
   Nenhum depende de dado de exemplo nem de "simulado".
2. Nenhum login faz o passo de outro perfil: nem pela tela, nem pelo chat, nem chamando a API. Os portões G1 a G22 valem
   nos três.
3. O dado de saúde só aparece para quem pode ver, e cada leitura fica registrada. A senha do gov.br só fica no cofre.
   Nenhum dado de cliente vai para o log.
4. Prazo, limite e cálculo vêm de código com teste, nunca da IA (G12, G15, G19).
5. Cada história do caminho cumpre a definição de pronto da história, com o aceite do Lucas na homologação.
6. "Concluído" só com o portal em produção (veja "O que a produção pede").

## Quem é quem

Toda tela inicial é "O que é meu hoje", com as tarefas, o prazo e a cor, mais a caixa de conversa (o chat), que só
responde o que o perfil pode ver.

| Perfil | Login de teste | O que faz nesta história |
|---|---|---|
| Atendimento | `atendimento@exemplo.ggv` | Recebe a Maria, marca a entrevista, cuida do contrato, cobra o que falta e leva a Maria ao banco |
| Líder do Atendimento | `lider@exemplo.ggv` | Vê e distribui as tarefas do setor |
| Documentação | `documentacao@exemplo.ggv` | Confere documentos e checklist, libera ao Jurídico e busca o que a exigência e a perícia pedem. Trabalha na Central do Atendimento |
| Advogada responsável | `advogada@exemplo.ggv` | Entrevista, benefício, cálculo, laudos, exigências, petição e confirmação do desfecho |
| Sênior (são duas) | `senior@exemplo.ggv` e `senior2@exemplo.ggv` | Confere antes do INSS, dispensa o parecer (as duas juntas), despacha, decide o recurso e faz a prestação de contas |
| Jurídico administrativo | `juridico@exemplo.ggv` | Protocola no Meu INSS, marca e acompanha a perícia |
| Financeiro | `financeiro@exemplo.ggv` | Recebe a prestação, liga para a Maria, marca o banco e confirma o recebimento |
| Sócio | `socio@exemplo.ggv` | Lê tudo e acompanha os resultados. Não faz passo do caso |

## 1. No balcão

1. **Atendimento** · A Maria chega ao balcão sem hora marcada. O Atendimento cadastra o lead e marca a entrevista na
   agenda de uma advogada (D1.01, D1.10). Nome, CPF e telefone passam pela biblioteca `campos`, e o servidor confere de
   novo.
2. **Atendimento** · Confirma a entrevista: 2 tentativas, com 3 dias entre elas; sem resposta, sobe para a Sênior (D1.04;
   G15; Lucas, GGVP-122). Se a Maria desiste antes, ficam o motivo e a data de recontato (G16).
3. **Atendimento** · A Maria preenche a ficha de atendimento e entrega os documentos. O papel passa pelo scanner, que
   deixa o arquivo na pasta do Drive que o portal lê (D1.05, D1.18; ADR-017).
4. **IA** · Lê cada documento pelo conteúdo, não pelo nome do arquivo: tipo, nome, CPF, data, assinatura e se está
   legível (D1.18).
5. **Documentação** · Confere o que a IA leu ("Conferir documento") e deixa cada documento na Maria e no caso certos
   (D1.02, D1.18).
6. **Sistema** · A senha do gov.br que a Maria informa vai direto para o cofre. Nunca fica em texto, nem na transcrição
   (D1.08; G9).

Confere no roteiro: AT1, AT2, AT3 e DO1.

## 2. A entrevista

1. **Advogada** · Antes de começar, lê a ficha que a IA já leu (D1.06). No acidentário, lê também a segunda ficha (D1.07).
2. **Advogada** · Entrevista a Maria. A gravação começa com o aviso de gravação (D1.09; G10). A transcrição sai sozinha,
   e a senha dita em voz alta sai do texto (D1.11; G9).
3. **IA, depois quem atendeu** · A IA preenche a ficha com o que foi dito; quem atendeu confere e salva (Lucas,
   GGVP-121).
4. **Advogada** · A IA recomenda o benefício pelo acervo e mostra de onde veio; a advogada confirma ou não. Se ela já
   citou um benefício, vale o dela. Tudo fica no histórico (D1.12; G3; Lucas, GGVP-106). A chance de êxito aparece
   desde aqui, só para o Jurídico e o Sócio, com o número de casos e a data da base (G22; Lucas, GGVP-131).
5. **Advogada** · O advogado do Atendimento, com o perfil Advogada, digita os vínculos do CNIS, que chega impresso ou
   baixado do Meu INSS. O servidor calcula tempo, pontos e carência (D1.13; G19; Lucas, GGVP-113 e GGVP-122).
6. **Advogada** · Registra se fechou. Não fechou: o motivo e a data de recontato (D1.14; G16). Fechou: a Maria vira
   cliente, e o caso nasce.

Confere no roteiro: AD1, AD2 e AT11.

## 3. O contrato e os documentos

1. **Atendimento** · Prepara o contrato pelo modelo do benefício, com o percentual de honorários. O contrato sai em PDF
   (D1.15, D1.16; Lucas, GGVP-136).
2. **Atendimento** · Colhe a assinatura em papel, digitaliza o contrato assinado, confere a leitura da IA e entrega a
   cópia impressa (D1.17, D1.19, D1.20).
3. **Atendimento** · Manda as boas-vindas e cobra o que falta: 2 tentativas, com 3 dias entre elas; depois, a Sênior
   (D1.22, D1.23; G15; Lucas, GGVP-122).
4. **Atendimento, depois Advogada** · O laudo novo pode chegar em qualquer fase. O Atendimento sobe no card da Maria; a
   IA lê, compara com o que já está no caso e resume; a advogada confere (D1.02, D1.21M).
5. **Advogada** · Dá o parecer médico. O caso só segue com o parecer "Suficiente" confirmado por uma pessoa. A dispensa
   é só das Sêniores: as duas, com justificativa (G17; Lucas, 01/10, GGVP-33). Documento que contradiz o requisito do
   benefício bloqueia o caso (G18).
6. **Atendimento** · Se o laudo não basta, pede o complemento ao médico. A orientação diz o que o documento deve abordar,
   sem sugerir diagnóstico, CID nem conclusão (G20).
7. **Documentação** · Confere o checklist do benefício: documentos, assinaturas e datas (D1.21; G1). Benefício sem
   checklist aprovado não libera o caso; a lista se cadastra pela Configuração, sem código (GGVP-104).
8. **Documentação** · Libera o caso ao Jurídico (D1.24). O portal barra a liberação sem o checklist aprovado, sem o
   contrato assinado e conferido ou sem o parecer (G1, G17).
9. **Sistema** · Os documentos conferidos vão para a pasta da Maria no Drive do escritório. O Drive só guarda o arquivo;
   o dado fica no portal (GGVP-107).

Confere no roteiro: AT4, AT5, SE3, DO2, AD3, SE2 e DO3.

## 4. No INSS

1. **Sênior** · Confere o caso antes do INSS: o checklist, o contrato, o parecer e o cálculo. Aprova, ou devolve com o
   motivo, e o "Ajustar o caso" volta ao Atendimento (D2.01; G1, G2, G17; GGVP-127).
2. **Jurídico administrativo** · Protocola no Meu INSS, só depois do OK da Sênior, com a senha tirada do cofre. Confere o
   requerimento, a data e o comprovante (D2.02; G2, G9).
3. **Advogada** · Decide se o caso precisa de perícia. Se precisa, o capítulo 5 corre junto (D2.03).
4. **Advogada** · Vigia o Meu INSS à mão. A tarefa "Trazer a resposta do INSS" fica na fila até ela registrar a decisão
   ou a exigência, e volta ao topo todo dia útil (D2.04; Lucas, GGVP-35 e GGVP-116).
5. **Advogada e Documentação** · Na exigência do INSS, a advogada analisa e define o setor, e a Documentação busca o
   documento. Cada item tem prazo, responsável e prova (D2.05; G21). O prazo do INSS conta dias corridos; se acaba em
   dia sem expediente, vai ao próximo dia útil (Lei 9.784, art. 66; GGVP-34).
6. **Sênior** · Deferido: a história pula para o capítulo 7. Deferido diferente do pedido: a Sênior analisa.
   Indeferido: a Sênior recebe "Despachar caso", e a história segue no capítulo 6 (D2.06, D2.07).

Confere no roteiro: SE1, JA1, AD4 e DO4.

## 5. A perícia

1. **Sistema** · Abre sozinho a tarefa da perícia (DP.01).
2. **Jurídico administrativo** · Marca a perícia no portal do INSS e sobe o comprovante em PDF (DP.02). Na perícia
   judicial, a data que vem na publicação vai sozinha para a agenda, com aviso no processo (Lucas, GGVP-53).
3. **Sistema** · Lê o comprovante e agenda os lembretes: os documentos 10 dias antes, a orientação 3 dias antes e a
   véspera (DP.04).
4. **Documentação** · Reúne o que a perícia pede e cobra o que falta (DP.03).
5. **Jurídico administrativo** · Liga para a Maria e manda a orientação pelo Chatwoot, padrão ou pelo perfil do perito.
   A tarefa só conclui com o envio confirmado (DP.05, DP.06; Lucas, GGVP-53). A orientação nunca manda esconder ou mudar
   a situação real (G11) nem sugere diagnóstico (G20).
6. **Jurídico administrativo** · Registra se a Maria compareceu. Se faltou, cabe uma remarcação; passou disso, sobe para
   a advogada responsável (DP.07; G15; Lucas, GGVP-104).
7. **Advogada** · Confere o resultado; só ela confere (DP.08; G15). O perfil do perito cresce laudo a laudo. O perito
   nasce da nomeação e do Raio-X, sem lista inicial (DP.09; Lucas, GGVP-131).

Confere no roteiro: JA2, JA3, DO6 e AD6.

## 6. Na Justiça

1. **IA, depois Sênior** · A IA analisa o motivo do indeferimento e sugere. Quem despacha é a Sênior: judicializar, ou
   encerrar com o motivo (D3.01 a D3.03; G4).
2. **Atendimento e Documentação** · Cumprem as pendências do despacho, cada uma no seu setor (D3.04).
3. **Advogada** · Pede a petição. A IA busca no acervo e escreve; a advogada confere e assina o conteúdo, ou pede outra
   versão (D3.05, D3.06, D4.07; G6). Número de jurimetria não entra no texto da peça (G22).
4. **Advogada** · Monta o pacote e protocola, depois das três travas: Tema 350, pacote completo e CPF conferido (D3.07;
   G7). O tribunal e a assinatura padrão, a do Dr. Glauco, vêm da Configuração. Começa pela Justiça Federal (GGVP-71,
   GGVP-87).
5. **Sistema** · Vigia as publicações 3 vezes por dia, pelo DJEN e pela AASP. A rodada que falha dispara alarme e nunca
   parece um dia sem publicação (D3a.01, D4.01; G13). A publicação é casada pelo CNJ e classificada, e o prazo é
   contado em dias úteis; na dúvida, vale a data mais cedo (D4.02, D4.03; G12).
6. **Advogada, com os setores** · Na exigência do juiz, a advogada analisa e define o setor, nunca a IA. Cada item tem
   prazo, responsável e prova. Sem o documento, primeiro pede dilação do prazo ou reagendamento da perícia; só depois
   justifica (D3a.02, D3a.03; G5, G21; Lucas, 07/10, GGVP-87). Prazo vencido com item sem prova avisa a Sênior e o
   líder (Lucas, 02/10, GGVP-68).
7. **Advogada** · Manifesta e protocola. O caso volta à vigília (D3a.04).

Confere no roteiro: SE4, AT8, DO5, AD5 e SE5.

## 7. O desfecho e o dinheiro

1. **IA, depois Advogada ou Sênior** · A IA lê a sentença. A advogada ou a Sênior confirma: procedente total, procedente
   parcial, improcedente, ou extinto sem julgar o mérito. Sem a confirmação, o caso não anda (GGVP-90, CA3 e CA4;
   Lucas, 13/10).
2. **Sênior** · Improcedente ou extinto: decide se recorre, com justificativa, e o prazo é contado pelo lado seguro.
   Recorrer abre "Elaborar e protocolar o recurso". Não recorrer abre o estudo de caso e a explicação à Maria (D3b.04,
   D3b.05; G12; GGVP-100).
3. **Advogada** · Procedente: abre "Acompanhar pagamento". Na Justiça, a prestação de contas nasce quando a RPV é
   expedida; no INSS, quando o pagamento cai. Quem diz que o pagamento caiu é uma pessoa do Financeiro ou do Jurídico,
   nunca uma fonte automática (D3b.01; Lucas, 13/10, GGVP-90).
4. **Sênior** · Faz a prestação de contas ("Prestar contas"): as parcelas e a entrada do contrato; Pix, boleto do
   escritório e a parte na Caixa. Ela edita até dar o OK, que é só dela. O percentual de honorários vem do contrato e
   não muda aqui (D2.06, D3b.02; G8; Lucas, GGVP-92; Mateus, 14/10).
5. **Financeiro** · Recebe a prestação e confere com o comprovante. A divergência volta à Sênior, com o motivo. Quem deu
   o OK não registra o recebimento (D3b.03).
6. **Financeiro** · Liga para a Maria, explica o recebimento e marca a ida ao banco: data, hora, agência e quem
   acompanha. A mensagem pelo Chatwoot é só complemento, depois da ligação (D3b.03; G8; Lucas, GGVP-98).
7. **Atendimento** · Leva a Maria ao banco e registra a ida. Se não deu, registra o motivo, e o Financeiro remarca
   (D2.06).
8. **Financeiro** · Confirma o recebimento. A Maria está com o dinheiro.
9. **Advogada, depois Atendimento** · A advogada aprova o texto que explica o resultado, e o Atendimento explica à Maria
   (D3b.06).
10. **Sistema** · O desfecho, o laudo e a publicação entram no acervo, sem duplicar e sem dado pessoal. A jurimetria
    aprende com eles (D4.05, D4.06).

Confere no roteiro: AD8, FI1, AT7 e AT10. O roteiro é de 12/10 e ainda põe a prestação com a advogada; desde 14/10 ela é
da Sênior.

## 8. Ao longo do caminho

- **A conversa** (D5) · A ligação e a conversa no balcão são gravadas com o aviso (G10) e transcritas. A mensagem do
  WhatsApp chega pelo Chatwoot na conversa do caso. A IA só muda na ficha o que foi dito; o valor antigo fica no
  histórico, e a Sênior confere e desfaz (G14; Lucas, GGVP-84). Pendência da conversa vira tarefa. Telefone, e-mail e
  dado bancário só mudam com a Maria verificada (GGVP-158, parte 6).
- **As tarefas** · A líder do Atendimento vê e distribui as tarefas do setor; a Sênior, as do Jurídico (Lucas, 02/10,
  GGVP-96). Toda espera lá fora (INSS, perito, Justiça, banco) é uma tarefa com prazo e lembrete (GGVP-116).
- **O caso** · O Atendimento e a Documentação leem o caso pela ficha da Maria. A página do processo é do Jurídico e do
  Sócio (GGVP-162). O chat não contorna portão.
- **O Sócio** · Lê tudo, inclusive o dado de saúde, as peças e os valores, e cada leitura de dado de saúde fica
  registrada. Acompanha os resultados, com a jurimetria sempre como "N casos · base de dd/mm" (G22). Não faz passo do
  caso (Lucas, 07/10; Pedro, 09/10).
- **A Configuração** · Kits por benefício, modelos, limites, tribunais e feriados mudam pela Gestão, sem código
  (GGVP-104).
- **O histórico** · Quem fez o quê, e quando, fica no histórico do caso, que só cresce (GGVP-99).

Confere no roteiro: ENT, LI1, AT6, AT9, AD7, SE6, SE7 e SO1.

## Fora da história hoje

Decidido, com a fonte. Quando a decisão mudar, muda aqui.

- O acompanhamento da RPV e do precatório: a linha do tempo, a previsão e o alerta (Lucas, 13/10, GGVP-90).
- A assinatura pelo ZapSign. A assinatura é em papel (Pedro, 09/10, GGVP-136).
- A medição de quanto cada ação ajuda a chance, no "Vale recorrer?" (espera o Lucas, GGVP-155).
- O lote de PDFs antigos pelo chat e a leitura do CNIS em PDF pela IA ficam para depois da produção (cartões de
  fechamento, 11/10).

## O que a produção pede

"Concluído" só vale em produção, e a produção só sobe depois do aceite do Lucas em todas as histórias (Mateus, 14/10).
Além do código, ela pede:

- **Do Lucas** (as perguntas de 11/10, GGVP-160):
  - a lista de logins reais, com nome, e-mail e perfil (GGVP-126);
  - o termo com os fornecedores de IA para o dado de saúde;
  - quem treina a equipe, e quando. O material está no [treinamento por perfil](../treinamento/por-perfil.md);
  - a OAB/UF do Dr. Glauco, para a assinatura da petição.
- **Do escritório, pela tela:**
  - a base real do acervo, que o Pedro sobe pelo importador do Raio-X (GGVP-148);
  - a planilha de clientes, em CSV (GGVP-146).
- **Da infra** (GGVP-158, parte 9, com o roteiro da [produção](../infra/producao.md)):
  - a homologação de volta a Oregon;
  - o backup e a restauração testados;
  - o PrevGGVLucas limpo;
  - o app da produção, com https e a chave nova do cofre;
  - as fontes da vigília com as OABs e a chave da AASP do escritório;
  - o monitor do /saude.

## Como conferir

- **Por jornada:** o [roteiro do teste](../entrega/roteiro-do-teste-09-10.md), na ordem da seção 5, cada perfil com o seu
  login.
- **Por história:** a [definição de pronto da história](definition-of-done.md) e o "Aceita" do Lucas no Jira.

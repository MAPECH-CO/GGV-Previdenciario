# Perfis, funções e telas

> Fonte versionada: [`docs/requisitos/funcoes-e-telas.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/requisitos/funcoes-e-telas.md) no repositório. Edite lá (por PR), não na wiki.

Base para a página inicial personalizada por perfil. Cada função entra no portal e vê **só o
trabalho dela**; o que é de outra função não aparece. Extraído dos diagramas em `docs/bpmn/`
(raias = funções), do modelo de `perfis.md` e das travas de `portoes-governanca.md`. As histórias
citadas são as candidatas do Jira `GGVP` (`candidatas/`).

> Toda home segue o mesmo esqueleto de `perfis.md`: **"O que é meu hoje"** (fila de tarefas com prazo
> e cor na que exige ação) + uma **caixa de conversa** (chat que herda o perfil) + navegação por caso
> em segundo plano. Muda o conteúdo e as ações, não o esqueleto.

## Achado estrutural: JURÍDICO é uma raia só
No board, `JURÍDICO` é **uma raia única** por diagrama (exceção desde 29/09/2026: o DP tem também a raia JURÍDICO (ADMINISTRATIVO), no lugar do ATENDIMENTO). A divisão em **advogada responsável / sênior /
estagiário-assistente** vem de `perfis.md`, pelo texto das caixas. Regra de atribuição:
- **Sênior:** D2.01 (conferência antes do INSS), D3.03 (despacho); recebe todo escalonamento por
  estouro de limite (G15), menos o da perícia, que sobe para a advogada responsável, e é quem dispensa parecer com justificativa (G17).
- **Estagiário/assistente (Jurídico administrativo):** D2.02 (protocolar no Meu INSS, só após o OK do sênior, G2) e, desde 29/09/2026, a perícia: DP.02, DP.06, DP.07 e a remarcação.
- **Advogada responsável:** todo o resto da raia JURÍDICO.
- **A confirmar (Q9):** D3.01 "quem viu o indeferimento", D3.06/D3a.04 "o advogado", D5.04/DP.08.

---

## Atendimento
**Raia:** ATENDIMENTO (D1, D2, D3, D3a, D3b, D5; saiu do DP em 29/09/2026).
**Tarefas:**
- D1: verificar/confirmar agendamento (D1.01, D1.04), encaminhar ao setor (D1.03), renovar senha
  gov.br (D1.08), calcular tempo e pontos (D1.13), recontatar na data (D1.14), conferir/corrigir e
  imprimir contrato (D1.16, D1.19, D1.20), pedir assinatura (D1.17), cobrar pendentes (D1.23), liberar
  ao Jurídico (D1.24).
- D2: agendar a ida ao banco (D2.06). D3/D3a: laço do setor Atendimento (D3.04, D3a.03).
- D3b: avisar o cliente do resultado e explicar (D3b.03, D3b.06).
- D5: subir/gravar a conversa (D5.01). D1: buscar e subir o laudo novo, em qualquer fase (D1.02).
  A perícia (DP.02, DP.06, DP.07) passou ao Jurídico administrativo em 29/09 (decisão do Lucas).
**Histórias:** GGVP-16, 21, 36, 60, 65, 69, 72, 77, 85, 89, 97, 101, 18, 29, 102, 98,
22. Compartilhadas: 58, 83, 76, 103.
**Nunca vê:** petição, estratégia jurídica, valores da prestação de contas. Não decide benefício (G3),
suficiência médica (G17/G20) nem setor da exigência (G5); não protocola (G2/G7); cobrança tem limite
que escala à sênior (G15).
**Home:** agenda do dia; fila de tarefas (assinatura, verificação de contrato, cobrança, exigência,
laudo novo a subir); leads a recontatar.

## Documentação · ADM
**Raia:** DOCUMENTAÇÃO · ADM (D1, D2, D3, D3a, DP).
**Tarefas:** receber documento no balcão (D1.02) e no card da cobrança (D1.23); reunir o que a perícia
pede (DP.03, quando o Jurídico administrativo decide que ela pede documento novo); laços de setor (D2.05, D3.04, D3a.03). (Digitalizar é [SCANNER] e ler é [IA]; a pessoa
confere.)
**Histórias:** GGVP-17, 81, 91, 95, 47, 56. Compartilhadas: 58, 83.
**Nunca vê:** petição, valores. Limite de cobrança escala à sênior (G15).
**Home:** sem painel próprio (decisão de 29/09): as tarefas de documentação entram na Central do Atendimento (cards de documentos pendentes, fila do scanner, checklist por benefício).

## Advogada responsável (Jurídico)
**Raia:** JURÍDICO (todos os diagramas). É o núcleo do trabalho.
**Tarefas:** preparar/entrevistar e definir benefício (D1.06–D1.13); vigiar e tratar exigência no INSS
(D2.03–D2.06); pedir/conferir petição e protocolar (D3.05–D3.07); vigília e exigências do juiz
(D3a.02–D3a.04); desfecho (D3b.02, D3b.04); diário e acervo, como quem confere (D4.01–D4.07);
perícia (decide no D2.03 e o sistema abre a tarefa, DP.01; confere o resultado e decide, DP.08–DP.10; recebe a
remarcação que passou do limite, G15); conversa (D5.04); governança médica e jurimetria (D1.21M, que inclui
conferir o laudo novo, e D4.02N).
**Histórias:** GGVP-28, 32, 40, 43, 46, 51, 57, 31, 35, 39, 44, 48, 63, 67, 71, 74, 79, 87, 90, 92,
100, 26, 34, 37, 45, 49, 70, 73, 80, 84, 88, 20, 25, 42, 50, 59, 64, 68. Compartilhadas: 86, 76, 52.
**Nunca vê:** configurações do escritório. A IA sugere, ela decide e assina (G3, G4, G6, G17); aviso
ao cliente só após o OK dela (G8).
**Home:** entrevistas do dia com a ficha lida; casos com decisão; exigências e perícias a conferir;
petições a pedir e conferir.

## Sênior (Jurídico)
**Raia:** JURÍDICO (conferência e despacho).
**Tarefas:** aprovar antes do INSS (D2.01); despachar após indeferimento (D3.03); estudo de caso
(D3b.05); vigília 3×/dia com alarme (D4.01); medir ganho/perda e alimentar o acervo (D4.05–D4.06);
importar o estudo prévio de peritos (D4.05); portão do parecer (G17).
**Histórias:** GGVP-23, 54, 19, 30, 41, 55, 33, 93, 99, 94.
**Nunca vê:** vê tudo do Jurídico. É quem despacha (G4), decide o que escalou (G15) e dispensa parecer
com justificativa (G17).
**Home:** casos aguardando conferência; despachos pendentes; tarefas que estouraram o limite; estudos
de caso. Botões Clientes, Processos e Gestão (painel de resultados a partir do Raio-X).

## Estagiário ou assistente jurídico (Jurídico administrativo)
**Raia:** JURÍDICO (protocolo) e, no DP, JURÍDICO (ADMINISTRATIVO). **Tarefas:** protocolar no Meu INSS (D2.02), só
após o OK do sênior; desde 29/09/2026 (decisão do Lucas), a perícia inteira: marcar no portal do INSS e subir o
comprovante em PDF (DP.02), decidir se a perícia pede documento novo (atribui à Documentação), ligar e orientar o
cliente (DP.06), registrar o comparecimento e remarcar (DP.07). Passou do limite de remarcações, sobe para a
advogada (G15).
**Histórias:** GGVP-27, 53, 61, 62, 66.
**Nunca vê:** valores, configuração. **Home:** Central própria, que voltou em 29/09 à noite com a perícia: protocolo no Meu INSS e tarefas da perícia (ver `docs/prototipo/figma.md`).

## Financeiro
**Raia:** FINANCEIRO (D2, D3b). **Tarefa:** receber e lançar a prestação de contas (D2.06, D3b.03).
Nenhuma decisão é da raia.
**Histórias:** **nenhuma tem o perfil Financeiro** — a tarefa está sob GGVP-44 (advogada) e GGVP-98
(Atendimento). **Lacuna de backlog: falta história própria para desenhar a home do Financeiro.**
**Nunca vê:** entrevista, petição, laudos. O aviso ao cliente depende do OK da advogada (G8).
**Home:** prestações de contas recebidas; botões Clientes, Processos, Gestão e Financeiro (recebido, a receber, lançamentos), ver `docs/prototipo/figma.md`.

## Gestão / Administração (proposto, fora do BPMN)
**Raia:** nenhuma. **Tarefas:** configuração do escritório — kits por benefício, modelos ZapSign,
limites de cobrança (os "a definir" de G15), mensagens padrão, perfis e permissões, roteiro de
conteúdo mínimo (D1.21M). Conforme conversado, também com **acesso ao Financeiro**.
**Histórias:** GGVP-96 (perfis e permissões), GGVP-104 (configuração). Tangencia GGVP-93.
**Nunca vê:** conforme o papel; nenhuma configuração contorna um portão. **Home:** configurações.

## Sócio (proposto, fora do BPMN)
**Raia:** nenhuma. **Tarefa:** acompanhar resultado (deferimento, procedência, extinções sem mérito,
rendimento), ligado a D3b e à medição de D4.05.
**História:** GGVP-75 (painel de resultado). **Nunca vê:** dado de saúde de cliente individual;
jurimetria abaixo do mínimo aparece como "amostra insuficiente" (G22). **Home:** painel de resultado.

## Cliente / lead (fora do portal interno)
**Raia:** CLIENTE/LEAD (topo do D1, raia externa desde 29/09; origem do D5) e CLIENTE (raia externa no D2, D3, D3a e DP). **Tarefas:** preencher a ficha (D1.05) e a segunda
ficha do acidentário (D1.07); assinar (D1.17); enviar documentos (D1.23) e laudo novo (D1.02); confirmar presença e comparecer à perícia (DP.06/07).
**História:** GGVP-24. **Nunca vê:** qualquer tela interna. Fora do portal: ficha, link de assinatura
e mensagens. Não usa "O que é meu hoje" nem o chat interno.

---

## Transversais (valem para toda função do portal)
- **GGVP-78** tela inicial "O que é meu hoje" — base da home personalizada.
- **GGVP-82** chat em linguagem natural — herda o perfil, não contorna portão.
- **GGVP-86** navegar pelo caso numa linha só (Jurídico/Atendimento).
- **GGVP-94** tarefa com laço, lembrete e escalonamento (sênior) — materializa G15/G21.
- **GGVP-99** histórico de quem fez o quê, incluindo a IA (sênior).
- **GGVP-103** cofre de senhas do gov.br (G9).

## Modelo de acesso das telas
- O perfil do usuário logado escolhe a home e o que existe na interface. O que não é da função **não é
  renderizado**, não só escondido (segue "Faz / Nunca vê" de `perfis.md`).
- Os portões G1–G22 valem em toda tela e no chat; dado de saúde e senha gov.br por perfil, nunca em log.
- Passos [IA]/[SISTEMA]/[SCANNER] sempre têm uma pessoa que confere; a home dessa pessoa é onde a
  conferência aparece (ex.: D4 não tem raia humana; a conferência vive nas homes de advogada/sênior).

## Pontos abertos (refinamento)
- **Q9** sênior e advogada: perfis distintos ou a mesma pessoa em casos diferentes?
- **Q20** "sócio" é perfil do portal e quem vê valores?
- **Q4** o cliente terá algum acesso ao portal?
- **Financeiro**: criar história e home próprias, ou manter dentro de Atendimento/advogada?
- **Passos novos** DP.00 e D4.02N ainda não desenhados no Miro; as telas ligadas a eles esperam. O D1.21M foi desenhado em 29/09 no subfluxo do laudo novo do D1.

## Próximo passo
O protótipo desktop está no Figma, com uma Central por função e as telas de ação por passo do BPMN:
ver `docs/prototipo/figma.md`. Depois da validação com o PO, **Railway** (navegável, com seletor de
perfil e dados fictícios).

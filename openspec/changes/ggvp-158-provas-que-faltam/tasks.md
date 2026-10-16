# Tasks

<!-- Só testes. Um teste por critério, com a história e o CA no nome. Rodar um arquivo por vez:
     `pnpm --filter @ggv/api exec vitest run <arquivo> --maxWorkers=1`. Se o teste mostrar que o código não faz o que o
     critério pede, o código não muda: o teste sai do commit e o critério vai ao PR como lacuna confirmada. -->

## GGVP-158 · 1. Recepção e entrevista

- [ ] 1.1 GGVP-93 CA3 · benefício sem roteiro: em `apps/api/src/rotas/parecer.test.ts`, o caso de aposentadoria por
  incapacidade permanente com laudo: análise "sem roteiro" sem chamar a IA, a tarefa com "benefício sem roteiro:
  conferência manual", o registro recusado sem a conferência e gravado com ela.
- [ ] 1.2 GGVP-36 CA1 · em `apps/api/src/rotas/recepcao-decisoes.test.ts`: a análise sem senha abre "Renovar senha do
  gov.br" para o Atendimento; com a senha no cofre, não.
- [ ] 1.3 GGVP-36 CA4 · no mesmo arquivo: o prazo da tarefa é o dia e a hora da entrevista.
- [ ] 1.4 GGVP-36 CA7 · no mesmo arquivo: a ficha que a advogada recebe traz o resultado da renovação, e a preparação
  (`pontosDeAtencao`) o mostra.
- [ ] 1.5 GGVP-28 CA1 · no mesmo arquivo: "pode ser acidentário" abre "Preencher segunda ficha" para o Atendimento, uma só.
- [ ] 1.6 GGVP-51 CA2 · arquivo novo `apps/api/src/fluxo/sugestao-do-beneficio.test.ts`, com a IA de mentira: sem
  benefício citado, a sugestão traz o benefício, o porquê e o trecho do acervo.

## GGVP-158 · 2. Página do processo

- [ ] 2.1 GGVP-86 CA2 · em `apps/api/src/rotas/processo.test.ts`: o bloco da perícia em andamento, com a origem da etapa.
- [ ] 2.2 GGVP-86 CA3 · no mesmo arquivo: os itens por setor, e os setores que não subiram o card.
- [ ] 2.3 GGVP-86 CA5 · no mesmo arquivo: o laudo novo no cabeçalho do processo.
- [ ] 2.4 GGVP-86 CA8 · no mesmo arquivo: quem se espera, desde quando e o prazo ou o lembrete.
- [ ] 2.5 GGVP-86 CA9 · no mesmo arquivo: as tarefas abertas de três setores, com o responsável e o prazo.
- [ ] 2.6 GGVP-86 CA11 · no mesmo arquivo: a origem e a data de cada documento.

## GGVP-158 · 3. Perícia

- [ ] 3.1 GGVP-151 CA2 · em `apps/api/src/rotas/recomendacao-pericia.test.ts`: com a recomendação aberta, a chance com os
  casos e a data da base.
- [ ] 3.2 GGVP-38 CA7 · no mesmo arquivo: a IA que escreve outro número não muda a porcentagem; o pedido da recomendação
  não leva número do perito.
- [ ] 3.3 GGVP-156 CA2 · arquivo novo `apps/api/src/rotas/pericia-por-perfil.test.ts`: a Documentação e o Atendimento
  veem o perito, sem os números nem os laudos; a advogada recebe os números.

## GGVP-158 · 4. Documentos, senha e indeferimento

- [ ] 4.1 GGVP-95 CA3 · arquivo novo `apps/api/src/rotas/documento-ilegivel.test.ts`: o laudo ilegível fica na pasta, a
  conferência o lista e o Atendimento recebe "Pedir documento legível".
- [ ] 4.2 GGVP-24 CA9 · arquivo novo `apps/api/src/rotas/senha-fora-do-kit.test.ts`: a senha de teste não aparece no PDF
  nem no Word do kit, nem na exportação do histórico.
- [ ] 4.3 GGVP-52 CA2 · em `apps/api/src/rotas/vigilia.test.ts`: o motivo do indeferido na busca do acervo e no trecho
  gravado pela rodada, com a referência do caso.
- [ ] 4.4 GGVP-52 CA5 · no mesmo arquivo: a falha do armazenamento no registro e a da IA no vetor; a segunda tentativa
  grava uma vez só.

## GGVP-158 · 5. Fechamento

- [ ] 5.1 typecheck, lint e a suíte da API; `openspec validate ggvp-158-provas-que-faltam --strict`.
- [ ] 5.2 PR para a main, com cada critério como "provado" ou "lacuna confirmada" (arquivo e linha).

# Tasks

<!-- Só testes. Um teste por critério, com a história e o CA no nome. Rodar um arquivo por vez:
     `pnpm --filter @ggv/api exec vitest run <arquivo> --maxWorkers=1`. Se o teste mostrar que o código não faz o que o
     critério pede, o código não muda: o teste sai do commit e o critério vai ao PR como lacuna confirmada. As tarefas
     "lacuna confirmada" ficam abertas: o teste que falha está nas notas da sessão, para quem corrigir. -->

## GGVP-158 · 1. Recepção e entrevista

- [x] 1.1 GGVP-93 CA3 · benefício sem roteiro: em `apps/api/src/rotas/parecer.test.ts`, o caso de pensão por morte com
  laudo: análise "sem roteiro" sem chamar a IA, a tarefa com "benefício sem roteiro: conferência manual", o registro
  recusado sem a conferência e gravado com ela.
- [x] 1.2 GGVP-36 CA1 · em `apps/api/src/rotas/recepcao-decisoes.test.ts`: a análise sem senha abre "Renovar senha do
  gov.br" para o Atendimento; com a senha no cofre, não.
- [x] 1.3 GGVP-36 CA4 · no mesmo arquivo: o prazo da tarefa é o dia e a hora da entrevista.
- [x] 1.4 GGVP-36 CA7 · no mesmo arquivo: a ficha que a advogada recebe traz o resultado da renovação, e a preparação
  (`pontosDeAtencao`) o mostra.
- [x] 1.5 GGVP-28 CA1 · no mesmo arquivo: "pode ser acidentário" abre "Preencher segunda ficha" para o Atendimento, uma só.
- [x] 1.6 GGVP-51 CA2 · arquivo novo `apps/api/src/fluxo/sugestao-do-beneficio.test.ts`, com a IA de mentira: sem
  benefício citado, a sugestão traz o benefício, o porquê e o trecho do acervo.

## GGVP-158 · 2. Página do processo

- [x] 2.1 GGVP-86 CA2 · em `apps/api/src/rotas/processo.test.ts`: o bloco da perícia em andamento, com a origem da etapa.
- [x] 2.2 GGVP-86 CA3 · no mesmo arquivo: os itens por setor, e os setores que não subiram o card.
- [ ] 2.3 GGVP-86 CA5 · lacuna confirmada: `GET /api/casos/:id/processo` (`apps/api/src/rotas/processo.ts:85`) não manda
  o laudo novo, e `casoDoServidor` (`apps/web/src/dados/caso.ts:591`) não monta o `laudoNovo` do cabeçalho.
- [ ] 2.4 GGVP-86 CA8 · lacuna confirmada: a espera vem só com o que se espera e desde quando
  (`apps/api/src/rotas/processo.ts:274`); a `etapa` não tem prazo nem lembrete, e a tela não os mostra
  (`apps/web/src/dados/caso.ts:672`).
- [ ] 2.5 GGVP-86 CA9 · lacuna confirmada na parte das perícias: as tarefas vêm por setor, com responsável e prazo (o teste
  da GGVP-146 prova), mas a perícia aberta vem uma só, a mais nova, sem responsável nem prazo
  (`apps/api/src/rotas/processo.ts:131` a `:165`; na tela, `responsavel: ''` em `apps/web/src/dados/caso.ts:660`).
- [x] 2.6 GGVP-86 CA11 · no mesmo arquivo: a origem e a data de cada documento.

## GGVP-158 · 3. Perícia

- [x] 3.1 GGVP-151 CA2 · em `apps/api/src/rotas/recomendacao-pericia.test.ts`: com a recomendação aberta, a chance com os
  casos e a data da base.
- [x] 3.2 GGVP-38 CA7 · no mesmo arquivo: a IA que escreve outro número não muda a porcentagem; o pedido da recomendação
  não leva número do perito.
- [x] 3.3 GGVP-156 CA2 · arquivo novo `apps/api/src/rotas/pericia-por-perfil.test.ts`: a Documentação e o Atendimento
  veem o perito, sem os números nem os laudos; a advogada e o Sócio recebem os números.

## GGVP-158 · 4. Documentos, senha e indeferimento

- [ ] 4.1 GGVP-95 CA3 · lacuna confirmada: o servidor guarda o original, marca o ilegível e o lista na conferência
  (`apps/api/src/rotas/recepcao-documentos.ts:305`), mas não abre "Pedir documento legível" para o Atendimento; essa
  tarefa só nasce na cópia do navegador (`apps/web/src/dados/leitura.ts:386`, chamada em
  `apps/web/src/paginas/CentralAtendimento.tsx:70`).
- [x] 4.2 GGVP-24 CA9 · arquivo novo `apps/api/src/rotas/senha-fora-do-kit.test.ts`: a senha de teste não aparece no PDF
  nem no Word do kit, nem na exportação do histórico.
- [x] 4.3 GGVP-52 CA2 · em `apps/api/src/rotas/vigilia.test.ts`: o motivo do indeferido na busca do acervo e no trecho
  gravado pela rodada, com a referência do caso.
- [x] 4.4 GGVP-52 CA5 · no mesmo arquivo: a falha do armazenamento no registro e a da IA no vetor; a segunda tentativa
  grava uma vez só.

## GGVP-158 · 5. Fechamento

- [ ] 5.1 typecheck, lint e a suíte da API; `openspec validate ggvp-158-provas-que-faltam --strict`.
- [ ] 5.2 PR para a main, com cada critério como "provado" ou "lacuna confirmada" (arquivo e linha).

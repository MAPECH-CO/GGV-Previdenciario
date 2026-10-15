# Design

## Context

- **Publicações:** `GET /api/publicacoes/:id` e `GET /api/casos/:id/publicacoes` (`rotas/publicacoes.ts`) têm `caso.ver` e devolvem `texto` e `trecho`; o desfecho (`rotas/desfecho.ts`) mascara o mesmo texto para quem não tem `dado_saude.ver_detalhe` e registra a leitura. As telas (`App.tsx`) usam `caso.ver`. Ninguém fora do Jurídico chega a elas por clique (a tarefa D3a.01 é da advogada; a ficha não linka).
- **Cópia da Recepção:** `GET /api/recepcao` (`rotas/recepcao-agenda.ts`) manda todos os contratos (`ContratoGuardado.contrato`), com `percentualHonorarios` e `acordo`, a quem tem `caso.ver`. A tela só usa esses campos no tipo (`regras/contratoDoCaso.ts`); a prestação lê o percentual do banco.
- **Confirmação da entrevista:** a escalada (`recepcao-agenda.ts`, `POST /api/agendamentos/:id/confirmacao`) abre uma linha na tabela da Recepção com `setor: 'Jurídico'`, que a cópia da advogada e o quadro do setor leem; a fila da Sênior lê só a tabela `tarefa` por `perfilDono`. As linhas da Recepção na tabela `tarefa` nascem em `fluxo/tarefas-da-recepcao.ts` (`DA_RECEPCAO` + `devidas`), sincronizadas a cada ficha guardada e a cada 5 min.
- **Esperas:** `POST /api/casos/:id/esperas/olhada` (`rotas/inss.ts`) tem `tarefa.cumprir`; a tela não tem o botão.
- **Cofre:** `podeRevelar` (`rotas/inss.ts`) deixa `exigencia_inss.tratar` passar e depois aceita qualquer passo de `PASSOS_COM_GOVBR` aberto.
- **Telas sem trava:** `TelaDoCaminho` (`App.tsx`) monta as telas de passo da documentação médica, do checklist, da liberação, da perícia e dos roteiros sem `Exige`; o servidor protege o dado, mas o ramo de exemplo da dispensa mostra a visão jurídica.
- **G22:** `FORMATOS_DA_JURIMETRIA` (`packages/contratos/src/ia.ts`) não casa "dos/das".
- **Perícia:** `ProcessoPericia.tsx` decide o conteúdo médico por uma lista fixa (`JURIDICO`) sem o Sócio; o servidor decide por `dado_saude.ver_detalhe`.
- **Checklist e leitura:** `POST /api/processos/:id/checklist/conferencia` e as decisões da leitura (`rotas/recepcao-documentos.ts`) usam `ficha.editar`; `ConferirChecklist.tsx` mostra "Concluir a conferência" a quem abre; o e2e das boas-vindas confere como Atendimento num caso da semente.
- **Papel assinado do servidor:** `dados/anexoEmPapel.ts` manda o contrato pela rota genérica da pasta (`POST /api/fichas/:id/arquivos` + `conteudo`), que não liga o arquivo à assinatura; `ColherAssinatura.tsx` desliga "Concluir a assinatura" no caso do servidor ("aguarda a vinculação"). A rota `POST /api/processos/:id/contrato/digitalizacao` (multipart, desde 14/10, P4.4) guarda o arquivo como documento do caso e o liga à assinatura; `assinatura-em-papel` conclui.

## Goals / Non-Goals

**Goals:** cada erro da spec corrigido no servidor (a trava é dele), a tela refletindo, com o teste que falhava antes; a matriz muda uma vez (v35), por último, sobre a main mais nova.

**Non-Goals:** regra de negócio nova; o botão "Olhei, sem novidade" na tela; o modo misto da cópia das telas; Chatwoot, Drive, IA e acervo.

## Decisions

1. **E1: trava `processo.abrir` em vez de mascarar o texto.** Mascarar pediria contrato novo e tela que trate texto nulo; a trava é uma linha por rota e por tela, e casa com a GGVP-162 (as publicações são da página do processo). O conjunto de `processo.abrir` (Jurídico e Sócio) é o mesmo de `dado_saude.ver_detalhe`. A leitura de publicação com classe (ou classe sugerida) de mérito registra `acesso_dado_sensivel`, como o desfecho.
2. **E2: tirar os campos na rota, não mudar a matriz.** `contrato.conduzir` (Atendimento e líder) e `valores.ver` (Financeiro e Sócio) já dizem quem vê o % e o acordo; a rota apaga os dois campos para os outros. Sem contrato novo: os campos já são opcionais no tipo.
3. **E3: a escalada vira linha de `DA_RECEPCAO`.** `'Confirmar agendamento': { passo: 'D1.04', perfil: 'senior', tela: '/agenda?ver=lista' }`, devida quando o lead tem entrevista aberta, futura, não confirmada e `confirmacao.naSenior`. Entra pelo mesmo sincronizador das outras linhas (sem tabela nova), e fecha sozinho quando a confirmação chega. A linha da tabela da Recepção (setor Jurídico) continua: é ela que alimenta o quadro do setor da Sênior.
4. **E4: 409 antes de gravar**, com a mesma mensagem da cobrança no limite (G15), quando `confirmacao.naSenior` e o resultado é "sem-resposta".
5. **E5: `inss.registrar_resposta` na rota.** É o conjunto que registra a resposta do INSS; a linha é da advogada, e o Jurídico administrativo também olha o Meu INSS.
6. **E6: quem não protocola só revela com `D2.05r` aberta.** A rota já sabe qual tarefa justificou a leitura (`tarefaDoGov`); para quem passou por `exigencia_inss.tratar`, ela tem de ser a da exigência.
7. **E7: `Exige` em `TELAS_DE_CASO`**, com `caso.ver` (a dispensa com `caso.aprovar_para_inss`), antes de `TelaDoCaminho`. Sem `caso.ver` a tela nem monta.
8. **E8: o padrão aceita "dos/das"** nos dois lugares (depois do % e entre o número e a unidade), mais "% dos casos" sem contagem. "25% dos honorários" e "acréscimo de 25%" seguem passando (a unidade não é da lista).
9. **E9: `pode(perfil, 'dado_saude.ver_detalhe')`** no lugar da lista fixa, pela sessão.
10. **E10: duas ações novas na matriz** (`checklist.conferir`, `documento.conferir`: `['documentacao']`), versão 35, com a impressão digital nova no teste. A tela do checklist esconde o botão por `usePerfil` (o padrão sem sessão segue Documentação, como os testes de unidade esperam). O e2e das boas-vindas entra como Documentação para conferir e volta ao Atendimento para a mensagem.
11. **E11: a tela usa a rota do contrato que já existe.** `anexarPapel` com `tipo: 'contrato'` manda o arquivo em FormData para `/processos/:id/contrato/digitalizacao`; a ficha de atendimento segue pelas duas rotas da pasta. `AnexarPapel` ganha `aoGuardar`, e a tela recarrega o contrato: o anexo aparece ligado e "Concluir a assinatura" habilita, chamando `assinatura-em-papel` como no exemplo. Sem rota nova: a regra (G1, só conclui com o arquivo) já é do servidor.

## Risks / Trade-offs

- [E1 tira a publicação de quem tinha `caso.ver` e precisava?] → ninguém: a leitura (D3a.01) é da advogada; a exigência do juiz vai aos setores pela própria exigência, não pela publicação.
- [E3 duas linhas para a mesma escalada no quadro do setor] → o quadro já junta por id; a linha nova tem id `confirmar-senior-<pessoa>`, diferente da da tabela da Recepção (`confirmar-senior-<agendamento>`); a Sênior vê as duas só no quadro, uma na fila.
- [E10 quebra teste que confere como Atendimento] → só o e2e das boas-vindas (dois testes) e nenhum teste do servidor (todos usam a Documentação); os dois trocam de login.
- [E11 mexe em tela do Pedro] → só o ramo do servidor de três arquivos fora de qualquer PR aberto (conferido em 15/10); o e2e do kit de verdade, que afirmava o botão desligado, passa a concluir.
- [Matriz v35 e outra sessão] → a versão sobe por último, depois de trazer a main; conflito resolvido no merge.

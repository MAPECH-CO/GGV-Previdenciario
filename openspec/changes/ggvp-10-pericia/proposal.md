# GGVP-10 · Perícia · passos BPMN: DP.01 a DP.10 (frame DP do Miro) · perfis: Jurídico administrativo, Documentação e advogada responsável

## Por quê

A perícia é chamada por três diagramas (pedido ao INSS, despacho da sênior e pedido do juiz) e hoje fica espalhada entre pessoas. Desde 29/09 (Lucas) ela é toda do Jurídico administrativo: o sistema abre a tarefa, ele marca no Meu INSS e sobe o comprovante (o sistema lê data, hora, local e tipo), decide se a perícia pede documento novo, orienta o cliente e registra o comparecimento; a Documentação reúne o que falta; a advogada confere o resultado e decide. A orientação sai da IA, padrão ou pelo perfil do perito, e nunca manda esconder ou mudar a situação real (G11) nem sugere diagnóstico (G20). Tudo fiel ao Figma (`nHOPzl005CpWDXUWyVZIo6`) e ao frame DP do Miro, ligado às telas da documentação médica.

## Histórias na ordem

Uma sessão, na pasta principal, na branch `feat/GGVP-10-pericia` (base: a documentação médica, porque a perícia usa o parecer, o roteiro e a classificação dos documentos médicos). Dois grupos, na ordem do fluxo DP.

**Grupo 1**

1. GGVP-49 · Iniciar a tarefa de perícia · sistema (a advogada decide antes)
2. GGVP-53 · Marcar a perícia com o cliente · Jurídico administrativo
3. GGVP-56 · Reunir o que a perícia pede · Documentação
4. GGVP-61 · Orientação da perícia, padrão ou pelo perfil do perito · Jurídico administrativo

**Grupo 2**

5. GGVP-62 · Preparar o cliente · Jurídico administrativo
6. GGVP-66 · Comparecimento e remarcação · Jurídico administrativo
7. GGVP-70 · Conferir o resultado e decidir o próximo passo · advogada responsável
8. GGVP-73 · Atualizar o perfil do perito · advogada responsável (a IA grava)

Cada história ganha uma spec em `specs/ggvp-n/spec.md` e uma seção no `tasks.md`, no bloco do seu grupo.

## Fora do escopo

- Servidor, banco e implantação (Mateus). Aqui só tela, sobre o servidor de exemplo em `apps/web/src/dados/`. Cada história deixa aberta a tarefa "ligar no servidor".
- A decisão que manda o caso para a perícia (GGVP-31, D2.03, no PR do INSS), o despacho da sênior (D3) e o pedido do juiz (D3a): aqui a perícia nasce por `iniciarPericia`, com a mesma forma. Ponta para ligar na junção.
- O perito nomeado vindo do acervo e a jurimetria do perito (GGVP-59, sem refino): dados de exemplo em `dados/peritos.ts`. Ponta para ligar.
- IA de verdade, Chatwoot, Meu INSS, GERID e leitura do PDF: simulados na tela.
- A página do processo inteira: aqui ela nasce com a perícia em destaque; as outras etapas aparecem e ficam indisponíveis até as histórias delas.

## Portões envolvidos

- G9 (senha do gov.br só no cofre), G11 (a orientação nunca manda esconder ou mudar a situação real), G15 (remarcação e cobrança com limite; na perícia, sobe para a advogada responsável), G19 (prazo e número são código com teste), G20 (sem diagnóstico, CID, grau, conclusão nem frase pronta) e G22 (jurimetria com amostra abaixo do mínimo aparece como "amostra insuficiente" e nunca chega ao cliente).

## Parâmetro sem número no cartão

- O limite de remarcações da perícia (GGVP-53 CA9, GGVP-66 CA3) não tem número: fica 2, como o da agenda (Pedro, 05/10) e o padrão do servidor do Mateus, em `regras/pericia.ts`. Levar ao Lucas.

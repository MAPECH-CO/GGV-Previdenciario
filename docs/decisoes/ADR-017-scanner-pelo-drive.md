# ADR-017 · O papel do scanner entra no portal pelo Drive

**Data:** 2026-10-13 · **Estado:** aceita · **Decidiu:** Mateus (MAPECH), na GGVP-158 (parte 4)

## Contexto
O papel do balcão passa no scanner. A automação do n8n ("DIGITALIZACAO · 20 · Lote escaneado") já faz o trabalho:
- decide a pasta do cliente em "#5. CLIENTES", ou "A REVISAR";
- dá nome ao arquivo ("Tipo - Nome do Cliente - AAAA-MM-DD.pdf");
- guarda o PDF pesquisável no Drive do escritório.

No portal, o lote do scanner era simulado: um botão da tela fazia o papel do aviso. A GGVP-158 pede o caminho de
verdade e manda escolher, e registrar aqui, entre o n8n avisar o portal e o portal ler a pasta do Drive.

## Opções consideradas
1. **O n8n avisa o portal.** Ao terminar cada lote, o fluxo chama uma rota do portal com um segredo.
   - O portal sabe na hora o que é o lote e se ele foi para revisão.
   - Exige mudar o fluxo do n8n, que é o principal da digitalização e roda em produção.
2. **O portal olha o Drive.** De tempos em tempos, o portal lê o que mudou no Drive e traz o arquivo novo da pasta de um
   cliente.
   - O n8n não muda.
   - Chega com até um minuto de atraso, e o portal não sabe o que o n8n mandou para revisão.

## Decisão
O portal olha o Drive (opção 2), por decisão do Mateus em 13/10.
- **Quando:** a cada minuto, na mesma batida da rodada que envia ao Drive (`principal.ts`).
- **Como:**
  - pela lista de mudanças do Drive compartilhado da pasta de clientes (`changes.list`);
  - a marca da lista fica na `configuracao` (`drive:mudancas`);
  - a primeira rodada só guarda a marca, sem trazer o passado.
- **O que entra:** o PDF ou a imagem novos cuja pasta é a de uma ficha.
  - A pasta ainda não ligada é ligada quando o título leva a uma ficha só, pela regra do balcão (CPF, depois nome, e os
    CPFs não podem brigar).
  - O arquivo vira uma linha de `documento` que aponta para o Drive, sem cópia no portal, e entra na ficha como chegado
    pelo scanner.
  - O portal baixa o conteúdo só para a leitura da IA.
  - O tipo anunciado sai do começo do nome; a IA lê e sugere, e a Documentação confere.
- **O que fica fora:**
  - pasta e lixeira;
  - o que o próprio portal enviou (a marca `portal`);
  - o que está em "A REVISAR";
  - o arquivo que já entrou (`drive_arquivo_id`).
- **O lote:** os arquivos de uma ficha na mesma rodada viram o lote da tarefa "Receber documento" aberta.
- **Onde não roda:** com o Drive só leitura. A homologação olha o Drive real do escritório e não traz documento de cliente.

## Consequências
- O n8n segue como está. A rota que simulava o lote só existe nos testes de tela (`LEITURA_SIMULADA`).
- **Atraso de até um minuto** entre o scanner e o portal.
- **O que sai de "A REVISAR" para a pasta do cliente também entra**, porque é uma mudança de pasta. É o caminho certo
  depois da revisão.
- **A pasta cujo título serve a duas fichas fica sem ligar.** O arquivo não entra até alguém ligar a pasta pela ficha.
- **Falha ao baixar não perde nada:** a marca não anda, e a rodada seguinte tenta de novo.
- **A conta de serviço do portal precisa ler o Drive compartilhado inteiro**, o que ela já faz para enviar.
- Reversível por outro ADR: o n8n pode passar a avisar uma rota do portal, e a rodada sai.

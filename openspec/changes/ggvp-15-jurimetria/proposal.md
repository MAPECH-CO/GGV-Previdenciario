GGVP-15 · Jurimetria e dashboards de análise · histórias: GGVP-55 (a parte sem chat), GGVP-75, GGVP-64 (parte 1), GGVP-141 (partes 1 e 2) e GGVP-59 (parte 1).

## Por quê

O escritório quer medir se o portal melhora o resultado e o rendimento. Os épicos anteriores já gravam casos, resultados do INSS, desfechos na Justiça, exigências, pareceres, perícias e prestações de contas. A Gestão mostra os indicadores calculados em código, só com dado real e com o número de casos ao lado de cada taxa (G22).

## Histórias na ordem

1. **GGVP-55** · Subir lote avulso de processos no acervo pelo chat e ver a base em uso na Gestão · Sênior. Só a parte sem o chat com ação e sem a IA (Mateus, 07/10):
   - **Base do acervo** na Gestão, com os que aguardam conferência (CA3).
   - **Conferir desfechos do lote** na Central da Sênior; só o conferido entra nas contas (CA7).
2. **GGVP-75** · Painel de resultado para os sócios · Sócio, e a Gestão (Sênior, líder do Atendimento e Financeiro).
   - **Indicadores do período**, cada um com o número de casos.
   - **Recorte** por benefício, perito, juízo e advogada.
   - **Extinções sem mérito** em destaque.
   - **Pareceres dispensados** comparados aos suficientes.
   - **Totais em dinheiro** só para o Sócio e o Financeiro.
   - **Raio-X de 979 processos** como referência.
3. **GGVP-64** · Juízo identificado: mostrar a jurimetria · advogada responsável. A parte 1 (Mateus, 08/10), sem migração e sem versão nova da matriz:
   - **Juízo do processo** pelo número CNJ: tribunal e unidade de origem, a mesma regra do painel (CA1, a identificação).
   - **Números do juízo** calculados em código, só com desfecho conferido: procedência por benefício e tempo até a sentença, cada um com os processos e a data da base (CA2, CA4, CA5).
   - **Minuta da petição:** a jurimetria do juízo entra nas fontes, só para a advogada, e o número fica fora do texto que vai ao juiz (CA3, CA6).
   - **Parte 2 (Mateus, 09/10, PR próprio sobre o #11):** a vara e o juiz conferidos na leitura da publicação; os entendimentos recorrentes do juízo pela IA, com os processos de exemplo; os entendimentos na minuta, sem número (CA1, CA2, CA5, CA6).
4. **GGVP-141** · Acervo alimentado pelo que as telas do Pedro conferem, com busca por significado · IA e sistema. A parte 1 (Mateus, 08/10):
   - **ADR-013**, a base de conhecimento, antes do código.
   - **Trechos do acervo** com vetor (pgvector, índice HNSW), anonimizados e com a marca de dado de saúde (CA1, CA3).
   - **Vetores pela OpenAI**, pelo motor, com registro (CA4).
   - **O acervo se alimenta sozinho**, em segundo plano: as fontes que a busca já usa e a conversa conferida do Relacionamento (CA1).
   - **Busca híbrida:** sentido e palavra misturados por RRF, sempre com a fonte (CA2).

   A parte 2 (Mateus, 09/10), sem migração: o parecer e o laudo conferidos, o resultado da perícia registrado e a transcrição conferida entram no acervo; o que a IA sugeriu e ninguém conferiu fica fora (CA1).
5. **GGVP-59** · Perito nomeado: identificar e mostrar a jurimetria · advogada responsável. A parte 1 (Mateus, 08/10), depois que a Perícia do Pedro entrou no servidor:
   - **Nomeação de perito** vira uma classe da leitura da publicação: a IA sugere, e a pessoa classifica (CA1).
   - **Quesitos e assistente técnico:** a tarefa da advogada, com o prazo do despacho ou, sem ele, 15 dias (CPC, art. 465, §1º), contado pelo código do prazo judicial (CA1, G12). Na Central, a tarefa abre a tela de perícias do caso, onde ficam os quesitos.
   - **O perito do texto:** reconhecido entre os peritos da base. Não reconhecido, a pergunta de um clique da Perícia resolve, sem travar (CA1, CA6).
   - **Já cobertos pela Perícia** (GGVP-61, GGVP-73 e GGVP-139): CA4, CA5, CA6, CA8, CA9 e CA10, e os números do perito em código, com o G22 (CA2, CA3 e CA7, por assunto).

Um ponto de "Agora ok?" no fim de cada história.

## Travadas
- **Q20 (Sócio como perfil):** com o Lucas desde 07/10; até a resposta, o Sócio vê a Gestão inteira, com os valores só em total.

## Fora do escopo

- **GGVP-55, o resto:**
  - o pedido pelo chat e o aviso com os ilegíveis (CA4, CA5) dependem do chat com ação e da IA, fora até 09/10;
  - a importação do estudo (CA1) é da MAPECH, e o estudo ainda não existe (Q13);
  - a unificação de grafias (CA2) segue a GGVP-59;
  - o acervo que se alimenta sozinho (CA6) depende da IA e do Drive.
- **O arquivo do Raio-X:** tem nome de cliente e dado de saúde. Entram só os agregados já publicados no protótipo.
- **GGVP-64, o que fica depois da parte 2:**
  - a sobreposição na página do processo lendo do servidor: a página ainda roda com dados de exemplo no navegador (ligar é da GGVP-146);
  - a recomendação de recurso (CA3 e CA6, D3b.04): segue a GGVP-100, travada pela Q26;
  - o órgão do DJEN como sugestão da vara, quando o PR das fontes reais entrar.
- **GGVP-141, o que fica fora:** o texto inteiro da transcrição e o resumo da IA da entrevista, porque ninguém confere.
- **GGVP-59, a parte 2:**
  - ligar o perito direto na perícia judicial a partir da publicação, porque mexe no modelo da Perícia do Pedro;
  - a sobreposição da página do caso lendo do servidor;
  - a taxa por benefício e por CID, que hoje é por assunto;
  - a pergunta no chat ("Como o perito avalia?").

## Portões envolvidos

G22 (regra de 07/10): toda porcentagem aparece com o número de casos e a data da base; não há amostra mínima.

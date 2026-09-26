# EXEMPLO-02 · Vincular a publicação ao processo e criar o prazo pré-preenchido

> **Exemplo didático, não é história do projeto.** Baseado no portal da GGV Previdenciário, primeiro produto da MAPECH, e na auditoria de uso de 11/09/2026, em que a tarefa "vincular publicação a processo e criar o prazo" não foi concluída. Não está no backlog do GGV Trabalhista e não deve ser construído. Serve só para mostrar como o template de história deve ser preenchido. Pessoas aparecem só por papel, e as respostas do PO são ilustrativas.

**Como** assistente jurídica\
**quero** abrir a publicação do dia, vinculá-la ao processo e criar o prazo já pré-preenchido\
**para** que nenhuma intimação fique sem prazo e ninguém redigite dados do processo.

**Passo BPMN:** `prev 1.8` · Acompanhamento processual, raia JURÍDICO. Numa história real, use o código do passo em `docs/bpmn/`.\
**Épico:** Contencioso\
**Prioridade do PO:** 1\
**Estimativa:** G

## Critérios de aceite
1. **Dado** publicações disponibilizadas hoje e designadas a mim, **quando** abro Publicações, **então** vejo o recorte "Hoje · minhas", com número do processo, tribunal e data de disponibilização de cada uma.
2. **Dado** uma publicação cujo número de processo existe na base, **quando** abro a publicação, **então** vejo o teor completo e o portal sugere o processo correspondente.
3. **Dado** a sugestão de processo correta, **quando** clico em Vincular, **então** a publicação passa a aparecer na aba Publicações do processo e sai do recorte "Sem vínculo".
4. **Dado** uma publicação vinculada, **quando** clico em Criar prazo, **então** o formulário vem com processo, tipo de ato e data de início preenchidos, e a data final calculada em dias úteis pela tabela de prazos do tipo de ato.
5. **Dado** que altero a data final calculada, **quando** salvo o prazo, **então** o portal exige o motivo da alteração e o registra no histórico do prazo.
6. **Dado** que outra pessoa tratou a mesma publicação enquanto eu estava com ela aberta, **quando** tento vincular, **então** o portal avisa que a publicação mudou e não sobrescreve o que a outra pessoa fez.
7. **Dado** que tenho perfil de jurídico supervisionado, **quando** crio o prazo, **então** ele fica com o status "a conferir" e aparece na fila da coordenação jurídica para confirmação.

## Fora do escopo desta história
- Capturar as publicações nos tribunais: elas chegam pelo serviço de publicações que o escritório já contrata.
- Avisar o cliente sobre o andamento: a automação prepara e uma pessoa aprova o envio, em história própria.
- Calcular prazo de tipo de ato que ainda não está na tabela: o portal cria o prazo sem data final e pede preenchimento manual.

## Dados e permissões
- **Ver publicações:** jurídico, jurídico supervisionado e coordenação jurídica.
- **Vincular e criar prazo:** jurídico e jurídico supervisionado.
- **Confirmar prazo criado pelo jurídico supervisionado:** coordenação jurídica.
- **Financeiro e captação:** não veem publicações nem teor.
- **Dado sensível:** sim. O teor pode trazer dados de saúde e de renda do cliente. Leitura só pelos perfis jurídicos, e o teor nunca aparece em listas fora do processo.

## Tela ou referência
- Tela Publicações do Prev, com as lacunas que a auditoria de 11/09 apontou: a linha da publicação não abria, não havia Vincular, e o prazo era criado sem ligação com a publicação.
- Esboço do detalhe: `Teor completo · Processo sugerido: 0000000-00.0000.0.00.0000 [Vincular] · [Criar prazo] · Status: a tratar`

## Dúvidas respondidas pelo PO
- Quem confirma o prazo criado por estagiário? → A coordenação jurídica, no mesmo dia. 15/09/2026, resposta ilustrativa.
- Quem mantém a tabela de prazos por tipo de ato? → A coordenação jurídica. 15/09/2026, resposta ilustrativa.
- E os feriados locais do tribunal? → Entram no calendário do tribunal. Se o tribunal não tiver calendário cadastrado, o portal marca o prazo como "conferir data". 15/09/2026, resposta ilustrativa.
- E se a publicação não tiver número de processo reconhecido? → Fica em "Sem vínculo" e a pessoa busca o processo à mão. 15/09/2026, resposta ilustrativa.

---

## Por que este exemplo está bem preenchido
_Esta seção existe só no exemplo. Não faz parte do template._
- A história nasce de uma dor medida: na auditoria, a tarefa não foi concluída por quem faz o trabalho.
- O critério 4 separa o que o portal calcula do que a pessoa só confirma. É aí que está o ganho.
- Os critérios 6 e 7 tratam concorrência e supervisão, que viram bug quando não são escritos.
- Com sete critérios e estimativa G, a história está no limite. Se o time estimar acima de G no refinamento, quebre em duas: "vincular publicação ao processo" e "criar prazo pré-preenchido a partir da publicação".

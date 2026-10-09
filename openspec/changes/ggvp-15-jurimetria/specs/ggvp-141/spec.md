# Spec Delta · ggvp-141

## Purpose

Acervo alimentado pelo que as telas conferem, com busca por significado: o que a pessoa confere entra no acervo da casa, e a IA acha também pelo sentido, para aprender com todos os casos, e não só com as petições e as decisões.
- **Parte 1 (08/10):**
  - a base de conhecimento (ADR-013);
  - o acervo que se alimenta sozinho com as fontes que a busca já usa e com a conversa conferida do Relacionamento;
  - os vetores pela OpenAI, com registro;
  - a busca híbrida.
- **Parte 2:**
  - o parecer, o laudo e o resultado da perícia, quando as telas forem ao servidor (PRs #39 e #42);
  - a transcrição (GGVP-133).

## ADDED Requirements

### Requirement: CA1 · O que é conferido entra no acervo, sem dado pessoal e com saúde só para o Jurídico
O que a pessoa confere nas telas SHALL entrar no acervo quando é salvo.
- O texto MUST NOT levar CPF, endereço nem telefone para outros casos.
- O dado de saúde MUST ficar só para o Jurídico.
- **Parte 1:** as fontes que a busca já usa e a conversa conferida do Relacionamento.
- **Parte 2:** o parecer, o laudo e o resultado da perícia, e a transcrição.

#### Scenario: CA1 · Conferido e salvo
- **Dado** o que a pessoa confere nas telas do Pedro (parecer, laudo e resultado da perícia, conversa conferida, transcrição)
- **Quando** é salvo
- **Então** entra no acervo, sem CPF, endereço nem telefone para outros casos, e com dado de saúde só para o Jurídico

### Requirement: CA2 · Busca híbrida, sempre com a fonte
Quando a IA buscar contexto, a busca SHALL juntar o sentido (pgvector, no PostgreSQL do Supabase, índice HNSW) com a palavra (a busca que já existe), misturados por classificação recíproca (RRF). Cada resultado MUST vir com a fonte. Sem o vetor da consulta, a busca SHALL seguir só pela palavra.

#### Scenario: CA2 · A IA busca contexto
- **Dado** o acervo
- **Quando** a IA busca contexto
- **Então** a busca junta o sentido (pgvector, no PostgreSQL do Supabase, índice HNSW) com a palavra (a busca que já existe), misturados por classificação recíproca (RRF), sempre com a fonte

### Requirement: CA3 · O mesmo item não duplica
O mesmo item processado de novo MUST NOT duplicar no acervo.

#### Scenario: CA3 · Processado de novo
- **Dado** o mesmo item processado de novo
- **Quando** entra
- **Então** não duplica

### Requirement: CA4 · Vetores da OpenAI, pelo motor, com registro
Os vetores SHALL vir do modelo de embeddings da OpenAI, pelo motor de IA do portal, e cada chamada MUST ficar registrada.

#### Scenario: CA4 · Vetores calculados
- **Dado** os vetores
- **Quando** são calculados
- **Então** vêm do modelo de embeddings da OpenAI, pelo motor, com registro

# ADR-013 · Base de conhecimento do acervo: pgvector no mesmo PostgreSQL, busca híbrida

**Data:** 2026-10-08 · **Estado:** aceita · **Decidiu:** Pedro e Mateus (MAPECH), na GGVP-134 e na GGVP-141

## Contexto
A IA do portal escreve petições, analisa indeferimentos e faz o estudo do caso perdido. Antes de escrever, ela consulta o
acervo da casa (GGVP-45). Hoje a consulta é só por palavra, com o full text do PostgreSQL, sobre cinco fontes:
- a petição aprovada;
- a decisão de mérito;
- o motivo de indeferimento;
- o modelo de petição;
- o estudo de caso.

O escritório quer que a IA aprenda com tudo o que a equipe confere (conversas, pareceres, laudos, perícias) e que ache
pelo sentido, e não só pela palavra exata. Os dados de saúde estão nesse material e precisam continuar sob o RLS e o
registro de acesso que o portal já tem (LGPD). O ADR-001 fixou TypeScript de ponta a ponta, sem segunda linguagem no
servidor.

## Opções consideradas
1. **Banco vetorial à parte** (Pinecone, Qdrant ou Weaviate): mais um serviço, mais um lugar com dado de saúde, outra
   cópia para manter em dia. Descartada.
2. **Bibliotecas de RAG, memória e grafo** (LlamaIndex, Haystack, Graphiti, Cognee, Mem0): são Python ou pedem outro
   banco. Servem de referência, não de peça.
3. **pgvector no PostgreSQL que já existe** (Supabase, projeto "Portal Operacional"), com a busca por palavra que o
   motor já usa: nenhum serviço novo, e o dado fica onde já está protegido.

## Decisão
Os trechos do acervo ganham um vetor no próprio PostgreSQL, com pgvector e índice HNSW. A busca junta o sentido (pgvector)
com a palavra (full text), misturados por classificação recíproca (RRF), e sempre devolve a fonte. Os vetores vêm do
modelo de embeddings da OpenAI (`text-embedding-3-small`, 1536 dimensões), pelo motor de IA do portal, com registro de
cada chamada.

## Consequências
- **Tabela `acervo_trecho`:** guarda o texto anonimizado (sem CPF, endereço, telefone nem o nome do cliente de origem), a
  marca de dado de saúde (só o Jurídico vê), o vetor e um hash que impede duplicar. Tem RLS, como toda tabela do portal.
- **Extensão `vector`:** a migração liga a extensão. No Supabase, ela pode ser ligada antes, no painel (Database →
  Extensions), caso o usuário do banco não tenha permissão. Nos testes, o banco embutido (PGlite) carrega a extensão.
- **O acervo se alimenta sozinho:** em segundo plano, junto com a sugestão pronta, sem tarefa de alimentar. O que já está
  lá, pelo hash, não ganha vetor de novo.
- **Sem a chave da OpenAI,** ou com dado de saúde sem a autorização do escritório (`IA_PERMITE_DADO_DE_SAUDE`), não há
  vetor, e a busca segue só por palavra. Nada trava.
- **O número da jurimetria** continua vindo de código (G22); a busca só traz contexto e fontes.
- **Fica para depois:** recortar textos longos em pedaços (hoje cada fonte é um trecho) e guardar a última leitura por
  fonte, quando o acervo passar de milhares de itens.
- Reversível só por outro ADR.

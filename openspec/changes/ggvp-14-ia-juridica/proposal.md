GGVP-14 · IA jurídica e knowledge graph · histórias: GGVP-106 (agora), GGVP-110; depois GGVP-38, GGVP-41, GGVP-45.

## Por quê

A IA estava estacionada até 09/10. Em 07/10 o Mateus decidiu ligar: a OpenAI sugere (texto, classificação, resumo) e a Mistral lê documento (OCR de PDF e foto). As chaves ficam só no ambiente (`.env.ia` local e Coolify). Antes de qualquer função usar a IA, vem a plataforma que garante as regras do projeto: a IA sugere, a pessoa decide, cada chamada fica registrada, e sem chave nada trava.

Branch empilhada na Garantia (`feat/GGVP-13-garantia-e-governanca`, PR #18), que tem a matriz de permissões e o registro de bloqueios.

## Histórias na ordem

1. **GGVP-106** · Guardrails de IA e do chat: a IA sugere, a pessoa confirma, tudo registrado · sistema.
2. **GGVP-110** · Conteúdo malicioso não manipula a IA · sistema.
3. **GGVP-38** · Recomendação sobre a perícia; **GGVP-41** · Medir ganho e perda e gravar no acervo; **GGVP-45** · Buscar no acervo antes de escrever: depois, quando o acervo tiver dado.

## Pergunta aberta ao Lucas (não trava a plataforma)

Laudo, receita e parecer passariam pela OpenAI e pela Mistral, ou seja, dado de saúde vai a um serviço de fora do escritório (LGPD). Até a resposta, nenhuma função manda documento médico à IA; a plataforma recusa essa finalidade.

## Fora do escopo

- O chat que executa ações (cards de confirmação): fora até 09/10 pelo plano de entrega; o chat só consulta.
- As funções que usam a IA (minuta da petição, leitura do laudo, sugestão do benefício, comprovante da perícia): entram cada uma na sua história, sobre esta plataforma.
- Google Drive (GGVP-107).

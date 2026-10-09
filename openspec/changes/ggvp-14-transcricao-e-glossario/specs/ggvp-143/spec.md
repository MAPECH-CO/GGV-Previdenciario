# Spec Delta · ggvp-143

## Purpose

Glossário do escritório: a Sênior mantém num lugar só os termos que o escritório usa (benefícios, siglas, nomes de peritos, juízos e varas), numa seção da Configuração do escritório. A transcrição (GGVP-133) e o motor de IA leem o glossário do banco do portal, para escrever certo os jargões do previdenciário. Saiu da GGVP-134 (CA7), por sugestão do Mateus em 08/10. Não há tela do glossário de termos no Figma (só o glossário de códigos e portões): a seção segue o padrão das outras seções da Configuração.

## ADDED Requirements

### Requirement: CA1 · A Sênior mantém o glossário, com histórico
Na Configuração do escritório, a gestão SHALL ver o glossário, e só a Sênior MUST acrescentar, corrigir e tirar termos. Cada mudança SHALL ficar no histórico da configuração, com quem mudou, o antes e o depois.

#### Scenario: CA1 · Abrir o glossário
- **Dado** a configuração do escritório
- **Quando** a Sênior abre o glossário
- **Então** vê, acrescenta, corrige e tira termos, e cada mudança fica no histórico

### Requirement: CA2 · Um lugar só, no banco
A transcrição e o motor de IA SHALL ler os termos do mesmo lugar, a tabela do glossário no banco do portal, por uma função só do servidor.

#### Scenario: CA2 · Ler o glossário
- **Dado** o glossário
- **Quando** a transcrição ou o motor de IA precisam dele
- **Então** leem do mesmo lugar, no banco do portal

### Requirement: CA3 · O glossário nasce com o que o portal já conhece
Quando o glossário nasce (a migração que cria a tabela), ele SHALL trazer os benefícios do catálogo, as siglas LOAS, BPC, CNIS, NB, DER, DIB, RPV e CTC, com o significado, e os peritos e juízos que o portal já conhece.

#### Scenario: CA3 · O começo
- **Dado** o começo
- **Quando** o glossário nasce
- **Então** já traz os benefícios do catálogo, as siglas mais usadas (LOAS, BPC, CNIS, NB, DER, DIB, RPV, CTC) e os peritos e juízos que o portal já conhece

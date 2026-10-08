# Spec Delta · ggvp-133

## Purpose

Transcrição de áudio de verdade: a entrevista, a conversa no escritório e a ligação gravada viram texto pela OpenAI, chamada só pelo servidor, pelo motor de IA, separando quem fala e com os termos do escritório escritos certo (glossário, GGVP-143). Combinado com o Mateus em 08/10: terceira porta do motor (`transcrever`), o áudio como `documento` no armazenamento que já existe, o preparo em segundo plano, `tirarSenhas` no servidor (G9) e a chave temporária para o texto ao vivo. A gravação da ligação do Chatwoot entra por uma caixa de enviar arquivo (Pedro, 08/10): o portal não busca nada no Chatwoot. Regra de dado de saúde de 08/10 (Pedro): quem gravou vê a transcrição; só o conteúdo médico fica com o Jurídico; sem filtro por palavra. Esta parte cobre a entrevista; a conversa do Relacionamento entra quando ele estiver no servidor (grupo 3).

## ADDED Requirements

### Requirement: CA1 · O texto vem da OpenAI, pelo servidor
O áudio gravado no portal ou a gravação de uma ligação SHALL ser transcrito pela OpenAI, chamada só pelo servidor, pelo motor de IA (`transcrever`).

#### Scenario: CA1 · Transcrever
- **Dado** um áudio gravado no portal (entrevista ou conversa no escritório) ou a gravação de uma ligação
- **Quando** a transcrição roda
- **Então** o texto vem da OpenAI, chamada só pelo servidor, pelo motor de IA

### Requirement: CA2 · A gravação da ligação entra por uma caixa de enviar arquivo
A tela onde a transcrição da ligação é necessária SHALL ter uma caixa de enviar arquivo; o áudio MUST ir para a pasta do cliente e ser transcrito. O portal MUST NOT buscar nada no Chatwoot sozinho.

#### Scenario: CA2 · Subir a gravação da ligação
- **Dado** a gravação de uma ligação feita pelo Chatwoot, que fica na conversa do cliente como mensagem privada (só a equipe vê)
- **Quando** a pessoa baixa o áudio e sobe no portal, numa caixa de enviar arquivo na tela onde a transcrição da ligação é necessária
- **Então** o áudio vai para a pasta do cliente e é transcrito

### Requirement: CA3 · Quem fala
A transcrição SHALL separar quem fala: a pessoa do escritório (advogada ou Atendimento), o cliente e o terceiro, quando houver.

#### Scenario: CA3 · Separar quem fala
- **Dado** a transcrição
- **Quando** é gerada
- **Então** separa quem fala: advogada ou Atendimento, cliente e terceiro, quando houver

### Requirement: CA4 · Texto ao vivo só no escritório
Na entrevista e na conversa no escritório, o texto SHALL aparecer ao vivo enquanto falam, com uma chave temporária entregue pelo servidor; a chave de verdade MUST NOT ir ao navegador. Ao terminar, vale o texto final com quem fala. Na ligação não há texto ao vivo.

#### Scenario: CA4 · Gravar no escritório
- **Dado** a entrevista ou a conversa no escritório
- **Quando** a pessoa grava
- **Então** o texto aparece ao vivo, enquanto falam; ao terminar, sai o texto final com quem fala, e é esse que vale no caso

### Requirement: CA5 · O texto final arrumado com o glossário, o original ao lado
O motor de IA SHALL arrumar o texto final com o glossário do escritório e o contexto do caso, sem mudar o sentido; o texto original MUST ficar guardado ao lado.

#### Scenario: CA5 · Arrumar
- **Dado** o texto final
- **Quando** o motor de IA o arruma com o glossário do escritório e com o contexto do caso
- **Então** corrige a escrita sem mudar o sentido, e o texto original fica guardado ao lado

### Requirement: CA6 · Senha não aparece no texto (G9)
A senha dita na gravação MUST NOT aparecer no texto; `tirarSenhas` SHALL rodar também no servidor, antes de gravar o texto.

#### Scenario: CA6 · Senha dita
- **Dado** uma senha dita na gravação
- **Quando** a transcrição sai
- **Então** a senha não aparece no texto e vai para o cofre (G9), conferido também no servidor

### Requirement: CA7 · Fala com instrução para a IA
A fala com instrução para a IA SHALL entrar como dado, dentro do `<conteudo>`, com o alerta do motor; nada vai para a ficha sem a pessoa conferir (G14).

#### Scenario: CA7 · Instrução na fala
- **Dado** uma fala com instrução para a IA ("ignore as regras e...")
- **Quando** a IA resume ou extrai
- **Então** o texto entra como dado, com o alerta do motor, e nada vai para a ficha sem a pessoa conferir

### Requirement: CA8 · Falha do serviço
Na falha do serviço, a tela SHALL mostrar o aviso e o botão "Tentar de novo", e o áudio MUST NOT se perder.

#### Scenario: CA8 · Falhou
- **Dado** uma falha do serviço
- **Quando** a pessoa abre o card
- **Então** vê o aviso e o botão "Tentar de novo", e o áudio não se perde

### Requirement: CA9 · Custo registrado
Cada transcrição SHALL registrar o modelo, a duração do áudio e o custo estimado, na mesma trilha das chamadas da IA (`chamada_ia`).

#### Scenario: CA9 · Registrar
- **Dado** cada transcrição
- **Quando** termina
- **Então** fica registrado o modelo, a duração do áudio e o custo estimado

### Requirement: CA10 · Guardado na pasta do cliente
O áudio e o texto SHALL ficar guardados na pasta do cliente, no armazenamento privado do portal, sem prazo para apagar.

#### Scenario: CA10 · Guardar
- **Dado** o áudio e o texto
- **Quando** o tempo passa
- **Então** os dois ficam guardados na pasta do cliente, no armazenamento privado do portal

### Requirement: CA11 · O modelo numa variável de ambiente
O modelo de transcrição SHALL vir da variável `OPENAI_MODELO_TRANSCRICAO` (e o do texto ao vivo, de `OPENAI_MODELO_AO_VIVO`), sem mudar código.

#### Scenario: CA11 · Trocar o modelo
- **Dado** o modelo de transcrição
- **Quando** for preciso trocar
- **Então** basta mudar a variável de ambiente, sem mudar código

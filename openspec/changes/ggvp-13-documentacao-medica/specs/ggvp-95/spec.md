# Spec Delta · ggvp-95 · Classificar cada documento médico que entra

## Purpose

Todo documento médico lido é classificado (atestado, relatório, laudo, prontuário, exame, CAT, boletim de ocorrência, relatório escolar ou de terapia), com a data, o emitente e o registro profissional, para o checklist saber o que de fato chegou. Quem usa: Documentação, na conferência da leitura (step_D1.18 `10:466`). O conteúdo médico fica com o Jurídico: a Documentação vê que o documento existe, o tipo, a data e quem emitiu. Passo D1.18 do Miro. Resposta do Lucas de 01/10: a mesma análise comparativa do laudo novo vale para todo documento médico que entra (GGVP-20). Contrato na `design.md`, seção GGVP-95.

## ADDED Requirements

### Requirement: CA1 · Tipo, data de emissão, médico e registro
Lido um documento médico, digitalizado ou enviado, o cartão SHALL mostrar o tipo, a data de emissão, o nome do médico e o registro profissional, quando constarem.

#### Scenario: CA1 · Leitura do documento médico
- **Dado** um documento médico digitalizado ou enviado
- **Quando** a IA lê
- **Então** o card mostra o tipo, a data de emissão, o nome do médico e o CRM, se constarem

### Requirement: CA2 · A correção vale e fica no histórico
A classificação corrigida pela Documentação SHALL valer, e a correção SHALL ficar no histórico.

#### Scenario: CA2 · Corrigir a classificação
- **Dado** uma classificação errada
- **Quando** a Documentação corrige
- **Então** a correção vale e fica no histórico

### Requirement: CA3 · Ilegível vira pendência do Atendimento
Quando a leitura falha, o documento SHALL virar a pendência "reenviar legível" para o Atendimento. O original MUST continuar guardado.

#### Scenario: CA3 · Documento ilegível
- **Dado** um documento ilegível
- **Quando** a leitura falha
- **Então** o item vira pendência "reenviar legível" para o Atendimento

### Requirement: CA4 · O laudo novo do card é classificado como os demais
O laudo novo que o Atendimento sobe no card SHALL ser classificado como os demais e SHALL seguir para a comparação com o que já está no processo (D1.21M, GGVP-20).

#### Scenario: CA4 · Laudo novo
- **Dado** um laudo novo que o Atendimento sobe no card do cliente (`D1.02`)
- **Quando** a IA lê
- **Então** ele é classificado como os demais e segue para a comparação com o que já está no processo (`D1.21M`)

### Requirement: CA5 · Só entra documento com dono identificado
O documento a classificar MUST estar ligado a um cliente identificado (nome e CPF). Documento sem dono identificado não entra; o que parece de outra pessoa fica em quarentena (GGVP-81).

#### Scenario: CA5 · Dono do documento
- **Dado** um documento que chega
- **Quando** vai ser classificado
- **Então** já está ligado a um cliente identificado (nome e CPF); documento sem dono identificado não entra no sistema

### Requirement: CA6 · Tipo sugerido, dados e confiança
Terminada a leitura, a tela SHALL mostrar o tipo sugerido, os dados extraídos e o grau de confiança; com confiança baixa, o documento SHALL ir para a conferência de uma pessoa.

#### Scenario: CA6 · Fim da leitura
- **Dado** a leitura da IA
- **Quando** termina
- **Então** mostra o tipo sugerido, os dados extraídos e o grau de confiança; com confiança baixa, o documento vai para a conferência de uma pessoa

### Requirement: CA7 · Duplicado: a Documentação decide
Para um possível duplicado, a Documentação SHALL decidir entre manter os dois ou descartar a cópia menos legível; o sistema MUST NOT descartar sozinho, e documento médico nunca é descartado.

#### Scenario: CA7 · Possível duplicado
- **Dado** um possível documento duplicado
- **Quando** a IA aponta
- **Então** a Documentação decide se mantém os dois ou descarta a cópia menos legível; o sistema não descarta sozinho

### Requirement: CA8 · O mesmo arquivo não duplica
Processar o mesmo arquivo de novo MUST NOT duplicar o documento.

#### Scenario: CA8 · Leitura repetida
- **Dado** o mesmo arquivo processado de novo
- **Quando** a leitura roda
- **Então** não duplica o documento

### Requirement: CA9 · O original fica guardado
O arquivo original SHALL ficar guardado; o texto do OCR MUST NOT substituí-lo.

#### Scenario: CA9 · OCR
- **Dado** o arquivo original
- **Quando** o OCR roda
- **Então** o original fica guardado; o texto do OCR não o substitui

### Requirement: CA10 · Arquivar recalcula o checklist
Arquivados os documentos classificados, o checklist do benefício SHALL ser recalculado e mostrar o que ainda falta.

#### Scenario: CA10 · Depois de arquivar
- **Dado** documentos classificados
- **Quando** são arquivados
- **Então** o checklist do benefício é recalculado e mostra o que ainda falta

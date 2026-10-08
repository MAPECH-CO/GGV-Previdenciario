# Spec Delta · ggvp-29 · Pedir o complemento ao médico do cliente

## Purpose

Com o parecer Insuficiente (ou Contraditório), o Atendimento leva ao cliente uma orientação para o médico dele, com os pontos que o relatório precisa abordar para aquele benefício, para o cliente voltar com o documento certo na primeira tentativa. Quem escreve: a IA sugere no parecer e a advogada confirma (resposta do Lucas, 01/10, Q1). O laço segue a cobrança (G15): com prazo do juiz ou do INSS, o limite é o prazo (Q2). A pendência é uma só e se encerra com o parecer refeito (Q4). Passos D1.21M e D1.23 do Miro. Figma: sem quadro próprio da orientação; visual de "Cobrar documento" `2106:3`; o botão "Pedir complemento ao médico" do Parecer médico `1654:2`. Contrato na `design.md`, seção GGVP-29.

## ADDED Requirements

### Requirement: CA1 · A orientação com o que falta, em perguntas ao médico
Aberta a pendência de um parecer Insuficiente, a tela SHALL mostrar a orientação com os itens ausentes escritos como perguntas ao médico.

#### Scenario: CA1 · Abrir a pendência
- **Dado** um parecer "Insuficiente"
- **Quando** abro a pendência
- **Então** vejo a orientação com os itens ausentes, escritos como perguntas ao médico (por exemplo, "Desde quando o paciente apresenta o quadro?", "Qual a previsão de duração?")

### Requirement: CA2 · A orientação não sugere diagnóstico nem traz frase pronta (G20)
A orientação MUST NOT sugerir diagnóstico, CID, grau nem conclusão, e MUST NOT conter as frases-chave do roteiro como texto a copiar.

#### Scenario: CA2 · Gerar a orientação
- **Dado** a orientação
- **Quando** é gerada
- **Então** não sugere diagnóstico, CID, grau nem conclusão, e não contém as frases-chave do roteiro como texto a copiar (G20)

### Requirement: CA3 · Sem o documento, a pendência segue o laço
Quando o cliente não traz o documento, a pendência SHALL seguir o laço com lembretes e escalonamento: 2 tentativas, 3 dias entre elas; no limite, a sênior decide (G15); com prazo do juiz ou do INSS, o limite é o prazo.

#### Scenario: CA3 · O cliente não traz
- **Dado** a pendência criada
- **Quando** o cliente não traz o documento
- **Então** ela segue o laço com lembretes e escalonamento (GGVP-94)

### Requirement: CA4 · O documento novo refaz o parecer
Chegado o documento novo, o parecer SHALL ser refeito (GGVP-20).

#### Scenario: CA4 · Chegou o documento
- **Dado** o documento novo
- **Quando** chega
- **Então** o parecer é refeito (GGVP-20)

### Requirement: CA5 · Do laudo novo ao fim da pendência
O documento pedido SHALL subir pelo card como laudo novo; a IA lê, compara e resume; a advogada confere e mantém ou refaz o parecer; e a pendência SHALL se encerrar com o parecer Suficiente.

#### Scenario: CA5 · O documento pedido chega
- **Dado** o documento pedido ao médico
- **Quando** o cliente ou o médico o manda
- **Então** o Atendimento sobe no card do cliente como laudo novo (`D1.02`), a IA lê, compara com o que já está no processo e resume (`D1.21M`), a advogada confere e mantém ou refaz o parecer, e a pendência de complemento se encerra

### Requirement: CA6 · O Atendimento vê o que falta e o resultado, nunca o conteúdo clínico
Na tarefa da pendência, o Atendimento SHALL ver o que falta pedir e o resultado do parecer, e MUST NOT ver o conteúdo clínico (CID, texto dos laudos).

#### Scenario: CA6 · Abrir a tarefa no Atendimento
- **Dado** a pendência de complemento
- **Quando** abro a tarefa no Atendimento
- **Então** vejo o que falta pedir e o resultado do parecer, mas não o conteúdo clínico (CID, texto dos laudos), que fica com o Jurídico

# Portões de governança (as travas que o BPMN desenhou)

Cada portão abaixo vira critério de aceite nas histórias indicadas. Nenhum pode ser contornado pela interface de chat.

| # | Portão | Onde está no BPMN | História |
|---|---|---|---|
| G1 | Nada vai para o INSS sem o checklist completo: documentos do benefício, todas as assinaturas e as datas preenchidas | D1, atenção no scanner | GGVP-91, GGVP-18 |
| G2 | Nada é protocolado sem o OK do sênior | D2, dica | GGVP-23 |
| G3 | A IA sugere o benefício, mas se a advogada citou um, prevalece o dela; o do RAG aparece só como sugestão | D1, dica | GGVP-51 |
| G4 | A IA analisa o indeferimento e sugere, mas quem despacha é a sênior | D3, atenção | GGVP-54 |
| G5 | Quem analisa a exigência do juiz e define o setor são os advogados, não a IA | D3a, atenção | GGVP-79 |
| G6 | A advogada assina o conteúdo da petição; se não está boa, a IA faz outra versão | D3 | GGVP-67 |
| G7 | Três travas antes de protocolar na Justiça: Tema 350, pacote completo e CPF conferido | D3, atenção | GGVP-71 |
| G8 | O aviso ao cliente só nasce depois do OK da advogada na prestação de contas | D3b, dica | GGVP-92, GGVP-98 |
| G9 | A senha do gov.br vai para o cofre; nunca fica em texto transcrito nem em campo de texto | D1 e D5 | GGVP-40, GGVP-103 |
| G10 | A conversa gravada começa com o aviso de gravação | D5, atenção | GGVP-76 |
| G11 | A orientação da perícia social nunca orienta a esconder ou mudar a situação real da casa | DP, atenção | GGVP-61 |
| G12 | Na dúvida, o prazo é contado pelo lado mais seguro | D4, atenção | GGVP-34 |
| G13 | A vigília roda 3 vezes por dia; rodada que falhou dispara alarme e nunca parece um dia sem publicação | D4, atenção | GGVP-30 |
| G14 | A IA só muda o que foi dito na conversa; o valor antigo fica no histórico e o Jurídico pode desfazer | D5, dica | GGVP-84 |
| G15 | Toda cobrança ou remarcação tem limite; passou dele, sobe para a sênior (ou o Jurídico, na perícia) | D1, D2, D3, D3a, DP | GGVP-94 |
| G16 | Todo lead que não vira cliente fica com o motivo registrado | D1, observação | GGVP-60 |
| G17 | O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa, com justificativa | Roteiro de laudos (v2) | GGVP-20, GGVP-33 |
| G18 | Documento que contradiz o requisito do benefício bloqueia o caso (por exemplo, "incapacidade total" na Aposentadoria PCD; lesão não consolidada no Auxílio-Acidente) | Roteiro de laudos (v2) | GGVP-20 |
| G19 | Regras numéricas (24 meses no LOAS, mais de 15 dias e janela de 60 dias na incapacidade temporária, períodos PCD) são calculadas por código com teste, nunca pela IA | Roteiro de laudos (v2) | GGVP-25 |
| G20 | A orientação ao médico ou ao cliente lista o que o documento deve abordar, sem sugerir diagnóstico, CID, grau, conclusão nem frase pronta | Roteiro de laudos (v2), no espírito de G11 | GGVP-29 |
| G21 | Toda exigência do juízo ou do INSS vira item com prazo, responsável e prova; sem prova em todos os itens, não se manifesta; perto do vencimento, escala para a sênior | Conversa de 26/09 (v2) | GGVP-68 |
| G22 | Jurimetria com amostra abaixo do mínimo aparece como "amostra insuficiente" e nunca chega ao cliente | Conversa de 26/09 (v2) | GGVP-59, GGVP-64 |

---

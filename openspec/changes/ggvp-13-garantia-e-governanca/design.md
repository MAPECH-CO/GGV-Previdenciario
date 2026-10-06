# Design · GGVP-13 Garantia e governança

## Grupo 1 · GGVP-109 e GGVP-25

### Context

Cada portão já recusa no servidor, no passo dele: G2 no protocolo do INSS, G1 e G17 na conferência da Sênior, G21 na resposta ao INSS e na manifestação, G6 e G7 nos protocolos da Justiça, G8 no aviso da ida ao banco, e a espera dos setores no pedido da petição. A trava por perfil (`exigir`) recusa e grava `acesso_negado`. O registro das recusas, porém, é desigual: umas gravam evento, outras não, e nenhuma tela mostra as tentativas à gestão. As regras numéricas do roteiro (`docs/requisitos/roteiro-laudos.md`) ainda não existem em código.

### Goals / Non-Goals

- Toda recusa de portão grava o mesmo formato no histórico (`evento_auditoria`): quem, quando, `caso:<id>`, `detalhe.portao` e `detalhe.passo`. A gestão lista as tentativas.
- Os botões principais com item de conferência obrigatório ficam desabilitados até a marcação.
- As quatro regras do roteiro em código puro, versionadas, com teste, atrás de um endpoint que as telas médicas do Pedro chamam.
- Fora: a liberação ao Jurídico (D1.24, épico do Pedro) e o chat com ação (não entra até 09/10). A liberação usa o mesmo formato de registro quando entrar.

### Decisions

1. **Sem tabela nova para as tentativas.** Elas já vão para `evento_auditoria`. A recusa que já tinha evento (`protocolo_recusado_sem_ok`, `conferencia_recusada`, `protocolo_bloqueado`, `pacote_divergente`) ganha `portao` e `passo` no `detalhe`. A que não tinha grava `portao_bloqueado`. A lista da gestão lê os eventos com `detalhe.portao` mais os `acesso_negado`.
2. **Nada de dado de saúde no registro.** O `detalhe` leva o código do portão, o passo e contagens (por exemplo, quantos itens sem prova), nunca a descrição do item.
3. **`acesso_negado` passa a levar o caso** quando a rota é `/api/casos/:id/...`, para a gestão ver em que caso foi.
4. **Regras como funções puras** em `apps/api/src/fluxo/regras.ts`, como o prazo judicial: `hoje` entra como parâmetro, e o mesmo insumo dá o mesmo resultado (CA8). Cada regra tem `versao` e `fundamento`. Mudou a regra, sobe a versão. O resultado devolve as entradas usadas e a versão; quem guarda o resultado no caso (o parecer e a perícia do Pedro) guarda a versão junto.
5. **Sem permissão nova.** O endpoint das regras usa `laudo.conferir`: as regras servem a quem confere a documentação médica. A matriz continua na versão 8, sem conflito com o Pedro.
6. **Valores das regras explícitos e com a lei citada:** 24 meses (LOAS, Lei 8.742, art. 20, §10); mais de 15 dias e janela de 60 dias (Decreto 3.048, art. 75, §§ 4º e 5º); carência de 12 contribuições, metade (6) depois de perder a qualidade e isenção marcada pela advogada (Lei 8.213, arts. 25, I; 26, II; 27-A); qualidade por 12 meses, mais 12 com mais de 120 contribuições sem perda e mais 12 com desemprego comprovado, até o dia 15 do segundo mês depois do fim da graça (Lei 8.213, art. 15; Decreto 3.048, art. 14).

### Contratos (`packages/contratos`, arquivo novo `governanca.ts`)

- `TentativaBloqueada` e `TentativasBloqueadas` (GET `/api/gestao/tentativas`, `gestao.ver`).
- `REGRAS`, `EntradaLoas24`, `EntradaIncapacidade`, `EntradaPcd`, `EntradaDii` e `ResultadoDaRegra` (POST `/api/regras/:regra`, `laudo.conferir`).

### Campos de formulário

Não há formulário novo neste grupo. As datas de entrada das regras usam `validarData` e `dataParaIso` de `campos`, para a tela médica que chamar o endpoint. As competências das contribuições vêm no formato `mm/aaaa`.

### Telas

- "Tentativas bloqueadas" (`/gestao/tentativas`), com quando, quem, caso, portão e passo. O link fica no topo da Central, só para quem tem `gestao.ver`.
- Protocolo no INSS, manifestação e prestação de contas: o botão principal fica desabilitado até a caixa de conferência obrigatória.

### Risks / Trade-offs

- A carência e a qualidade de segurado são a leitura da lei, e o Lucas confere na homologação. Os valores ficam como constantes nomeadas, com o artigo ao lado.
- A lista da gestão lê até 200 eventos, os mais recentes. Paginação só quando a gestão pedir.

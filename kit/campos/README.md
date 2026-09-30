# campos · os campos de formulário do portal, uma vez, com teste

Os bugs bobos das duas tentativas anteriores (data aceitando letra, CPF sem normalizar, CEP sem preencher o endereço, número aceitando letra, nome aceitando número) morrem aqui. Toda tela e todo endpoint usam estas funções. **Nunca validação solta na tela.**

Sem dependência. TypeScript puro. Roda com `node --experimental-strip-types` (Node 22.6 ou mais novo).

| Campo | Funções | O que garante |
|---|---|---|
| Número | `somenteDigitos`, `normalizarInteiro`, `validarInteiro`, `normalizarDecimal`, `validarDecimal`, `formatarDecimal` | Letra não entra. `1.234,56` vira `1234.56`. |
| CPF | `normalizarCpf`, `validarCpf`, `formatarCpf` | Onze dígitos, não repetidos, dígito verificador conferido. |
| CEP | `normalizarCep`, `validarCep`, `formatarCep`, `buscarCep` | Oito dígitos. `buscarCep` consulta o ViaCEP e devolve o endereço para preencher logradouro, bairro, cidade e UF sozinho. |
| Data | `analisarData`, `validarData`, `normalizarData`, `formatarData`, `dataParaIso`, `isoParaData` | Só `dd/mm/aaaa`. `31/02` não existe. Vai para o banco como `aaaa-mm-dd`. |
| Telefone | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` | Fixo com 10, celular com 11 e terceiro dígito 9, DDD válido, `+55` tirado. |
| CNJ | `normalizarCnj`, `validarCnj`, `formatarCnj`, `gerarDvCnj` | Vinte dígitos com o DV da Resolução 65 conferido (mod 97). |
| NB | `normalizarNb`, `validarNb`, `formatarNb` | Dez dígitos. **DV não conferido**: confirmar o algoritmo com o escritório na GGVP-108. |
| Nome, e-mail | `normalizarNome`, `validarNome`, `validarEmail` | Número não entra em nome. |

## Testar

```
cd kit/campos
npm test
```

## Como usar na história

1. Na `design.md` da change, liste cada campo e a função daqui que ele usa.
2. Na tela: normaliza ao digitar, valida ao sair do campo, mostra a mensagem em português. CEP válido dispara `buscarCep` e preenche o endereço.
3. No servidor: valida de novo com a mesma função dentro do schema Zod (`z.string().refine(validarCpf, 'CPF inválido')`). A tela nunca é a única trava.
4. Teste Playwright da tela digita letra no campo de data e no de CPF e confere que não passa.

## Para onde vai

Na história **GGVP-108** o Mateus move esta pasta para `packages/campos` do monorepo, troca o `node --test` por Vitest, e o pacote passa a ser importado por `apps/web` e `apps/api`. As funções e os testes ficam iguais.

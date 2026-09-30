import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  somenteDigitos, normalizarInteiro, validarInteiro, normalizarDecimal, formatarDecimal,
  normalizarCpf, validarCpf, formatarCpf,
  normalizarCep, validarCep, formatarCep, buscarCep,
  analisarData, validarData, normalizarData, formatarData, dataParaIso, isoParaData,
  normalizarTelefone, validarTelefone, formatarTelefone,
  validarCnj, formatarCnj, gerarDvCnj,
  validarNb, formatarNb,
  normalizarNome, validarNome, validarEmail,
} from '../src/index.ts';

// Os bugs que apareceram nas duas tentativas anteriores viram teste aqui.

test('número: letra não entra', () => {
  assert.equal(somenteDigitos('12a3'), '123');
  assert.equal(normalizarInteiro('12a'), null);
  assert.equal(normalizarInteiro('1.234'), 1234);
  assert.equal(normalizarInteiro('-12'), -12);
  assert.equal(validarInteiro('abc'), false);
  assert.equal(normalizarDecimal('1.234,56'), 1234.56);
  assert.equal(normalizarDecimal('R$ 1.234,56'), 1234.56);
  assert.equal(normalizarDecimal('12,5'), 12.5);
  assert.equal(normalizarDecimal('12a'), null);
  assert.equal(normalizarDecimal(''), null);
  assert.equal(formatarDecimal(1234.5), '1.234,50');
});

test('cpf: normaliza, valida o dígito, formata', () => {
  assert.equal(normalizarCpf('111.444.777-35'), '11144477735');
  assert.equal(validarCpf('111.444.777-35'), true);
  assert.equal(validarCpf('529.982.247-25'), true);
  assert.equal(validarCpf('111.444.777-36'), false);
  assert.equal(validarCpf('111.111.111-11'), false);
  assert.equal(validarCpf('1114447773'), false);
  assert.equal(validarCpf('abc'), false);
  assert.equal(formatarCpf('11144477735'), '111.444.777-35');
});

test('cep: valida e formata', () => {
  assert.equal(normalizarCep('01001-000'), '01001000');
  assert.equal(validarCep('01001-000'), true);
  assert.equal(validarCep('abc'), false);
  assert.equal(validarCep('00000000'), false);
  assert.equal(formatarCep('01001000'), '01001-000');
});

test('cep: preenche o endereço pelo ViaCEP', async () => {
  const fetchOk = (async () => new Response(JSON.stringify({
    cep: '01001-000', logradouro: 'Praça da Sé', complemento: 'lado ímpar', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308',
  }), { status: 200 })) as unknown as typeof fetch;
  const e = await buscarCep('01001-000', fetchOk);
  assert.deepEqual(e, { cep: '01001000', logradouro: 'Praça da Sé', complemento: 'lado ímpar', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP', ibge: '3550308' });

  const fetchNaoExiste = (async () => new Response(JSON.stringify({ erro: true }), { status: 200 })) as unknown as typeof fetch;
  assert.equal(await buscarCep('99999-999', fetchNaoExiste), null);

  const fetchCaiu = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
  assert.equal(await buscarCep('01001-000', fetchCaiu), null);
  assert.equal(await buscarCep('abc', fetchOk), null);
});

test('data: letra não entra, 31/02 não existe', () => {
  assert.equal(analisarData('aa/bb/cccc'), null);
  assert.equal(analisarData('31/02/2024'), null);
  assert.equal(analisarData('2024-02-29'), null);
  assert.equal(validarData('29/02/2024'), true);
  assert.equal(validarData('29/02/2023'), false);
  assert.equal(formatarData(analisarData('05/10/2026')!), '05/10/2026');
  assert.equal(dataParaIso('29/02/2024'), '2024-02-29');
  assert.equal(dataParaIso('31/02/2024'), null);
  assert.equal(isoParaData('2024-02-29'), '29/02/2024');
  assert.equal(isoParaData('2024-02-30'), null);
  assert.equal(normalizarData('29022024'), '29/02/2024');
  assert.equal(normalizarData('29a22024'), '29a22024');
});

test('telefone: fixo, celular, com +55', () => {
  assert.equal(normalizarTelefone('+55 (11) 96920-5041'), '11969205041');
  assert.equal(validarTelefone('(11) 96920-5041'), true);
  assert.equal(validarTelefone('(11) 3234-5678'), true);
  assert.equal(validarTelefone('(11) 86920-5041'), false);
  assert.equal(validarTelefone('(01) 96920-5041'), false);
  assert.equal(validarTelefone('11111111111'), false);
  assert.equal(validarTelefone('abc'), false);
  assert.equal(formatarTelefone('11969205041'), '(11) 96920-5041');
  assert.equal(formatarTelefone('1132345678'), '(11) 3234-5678');
});

test('cnj: dígito verificador mod 97', () => {
  assert.equal(gerarDvCnj('0001234', '2024', '8', '26', '0100'), '71');
  assert.equal(validarCnj('0001234-71.2024.8.26.0100'), true);
  assert.equal(validarCnj('0000001-90.2023.4.03.6100'), true);
  assert.equal(validarCnj('0001234-72.2024.8.26.0100'), false);
  assert.equal(validarCnj('123'), false);
  assert.equal(formatarCnj('00012347120248260100'), '0001234-71.2024.8.26.0100');
});

test('nb: formato de 10 dígitos', () => {
  assert.equal(validarNb('123.456.789-0'), true);
  assert.equal(validarNb('1111111111'), false);
  assert.equal(validarNb('12345'), false);
  assert.equal(formatarNb('1234567890'), '123.456.789-0');
});

test('nome e e-mail: número não entra em campo de letra', () => {
  assert.equal(normalizarNome('  Ana   Lima '), 'Ana Lima');
  assert.equal(validarNome('Ana Lima'), true);
  assert.equal(validarNome("João D'Ávila-Souza"), true);
  assert.equal(validarNome('Jo4o'), false);
  assert.equal(validarNome('A'), false);
  assert.equal(validarEmail('ana@ggv.adv.br'), true);
  assert.equal(validarEmail('ana@ggv'), false);
});

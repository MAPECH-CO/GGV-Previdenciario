#!/usr/bin/env node
// Hook UserPromptSubmit do kit. Nunca bloqueia. Só lembra ao Claude em que ponto a história está.
// Entrada: JSON do Claude Code no stdin. Saída: JSON com additionalContext (ou nada).
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sh(cmd, cwd) {
  try { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); }
  catch { return ''; }
}

function contarTarefas(arquivo) {
  try {
    const t = fs.readFileSync(arquivo, 'utf8');
    const feitas = (t.match(/^\s*- \[[xX]\]/gm) || []).length;
    const abertas = (t.match(/^\s*- \[ \]/gm) || []).length;
    return { feitas, total: feitas + abertas };
  } catch { return null; }
}

function main() {
  let entrada = '';
  try { entrada = fs.readFileSync(0, 'utf8'); } catch { /* sem stdin */ }
  let cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try { const j = JSON.parse(entrada || '{}'); if (j.cwd && fs.existsSync(j.cwd)) cwd = j.cwd; } catch { /* ignora */ }

  const raiz = sh('git rev-parse --show-toplevel', cwd) || cwd;
  const branch = sh('git rev-parse --abbrev-ref HEAD', raiz) || '?';
  const m = branch.match(/GGVP-(\d+)/i);
  const linhas = [];

  if (!m) {
    linhas.push(`Kit GGV · branch \`${branch}\`, sem chave GGVP-n.`);
    linhas.push('Se o pedido é desenvolvimento: não edite código aqui. Peça para rodar `kit/nova-historia GGVP-n` primeiro (cria a branch da história).');
  } else {
    const chave = `GGVP-${m[1]}`;
    const dirChanges = path.join(raiz, 'openspec', 'changes');
    let change = null;
    try {
      change = fs.readdirSync(dirChanges, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'archive' && d.name.toLowerCase().includes(`ggvp-${m[1]}`))
        .map(d => d.name)[0] || null;
    } catch { /* sem openspec */ }

    let historia = '';
    try {
      const cand = path.join(raiz, 'docs', 'requisitos', 'candidatas');
      historia = fs.readdirSync(cand).filter(f => f.toUpperCase().startsWith(`${chave}-`)).map(f => `docs/requisitos/candidatas/${f}`)[0] || '';
    } catch { /* sem candidatas */ }

    if (!change) {
      linhas.push(`Kit GGV · história ${chave}, branch \`${branch}\`, SEM change do OpenSpec.`);
      linhas.push(`Não escreva código. Leia a história (${historia || 'Jira ' + chave}) e responda com o comando pronto para colar: /opsx:propose "${chave}: <título curto>". Se o pedido mistura histórias, um comando por história. Critério com [decidir] aberto: pergunte antes de propor.`);
    } else {
      const t = contarTarefas(path.join(dirChanges, change, 'tasks.md'));
      const prog = t ? `${t.feitas}/${t.total} tarefas` : 'tasks.md ainda não existe';
      linhas.push(`Kit GGV · história ${chave}, change \`${change}\`, ${prog}.`);
      if (t && t.total > 0 && t.feitas === t.total) {
        linhas.push('Todas as tarefas marcadas. Rode as verificações (typecheck, lint, testes, Playwright se há tela), mostre a saída e pergunte "Agora ok?". Com o ok, o dev roda /ok.');
      } else {
        linhas.push('Siga o tasks.md, uma tarefa por vez, com teste. Ao terminar ou depois de cada ajuste: verificações, saída na tela, e a pergunta "Agora ok?". Sem subagente. Menor mudança que cumpre o critério.');
      }
    }
  }

  const saida = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: linhas.join(' ') } };
  process.stdout.write(JSON.stringify(saida));
}

try { main(); } catch { /* nunca derruba o prompt */ }
process.exit(0);

#!/usr/bin/env node
/*
 O log de um build do EAS, legível.

 ## Por que isto existe

 Quando um build do Android falha, o EAS diz apenas:

   Error: Gradle build failed with unknown error.
   See logs for the "Run gradlew" phase for more information.

 A causa real está no log, e o log é acessível pela API — `eas build:view --json`
 devolve `logFiles`, com URLs assinadas. Mas o arquivo vem **comprimido com
 Brotli, sem cabeçalho**: `file` não reconhece, `gzip` recusa, e ler os
 primeiros bytes só mostra ruído. Em 14/08 isso me custou meia hora e três
 builds diagnosticados por adivinhação, até descobrir o formato.

 O conteúdo, uma vez descomprimido, é NDJSON — um registro por linha, com o
 texto em `msg`.

 ## Uso

   node scripts/log-do-build.mjs <id-do-build>          # só o erro
   node scripts/log-do-build.mjs <id-do-build> --tudo   # o log inteiro

 O id sai da URL que o `eas build` imprime, ou de `eas build:list`.
*/

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

/**
 * O `eas` só funciona de dentro do app, que é onde vive o `eas.json`.
 *
 * Rodado da raiz do monorepo ele falha com "build:view command failed", sem
 * dizer que o problema é o diretório.
 */
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile');

const id = process.argv[2];
const tudo = process.argv.includes('--tudo');

if (!id) {
  console.error('uso: node scripts/log-do-build.mjs <id-do-build> [--tudo]');
  process.exit(2);
}

/** As marcas que indicam onde o Gradle explicou o que houve. */
const SINAIS = /FAILURE:|What went wrong|Execution failed|Caused by:|^e: |error:|Manifest merger failed/;

/**
 * Descomprime tentando os formatos que o EAS já usou.
 *
 * Brotli primeiro porque é o atual. Os outros ficam porque isto não é código
 * quente e o custo de tentar é nulo — enquanto o custo de o script quebrar no
 * dia em que o formato mudar é outra meia hora de garimpo.
 */
function descomprimir(bytes) {
  for (const tentar of [brotliDecompressSync, gunzipSync, (b) => b]) {
    try {
      const texto = tentar(bytes).toString('utf8');
      if (texto.includes('Task ') || texto.includes('phase')) return texto;
    } catch {
      // formato errado; tenta o próximo
    }
  }
  throw new Error('não reconheci o formato do log — ver o cabeçalho deste arquivo');
}

const info = JSON.parse(
  execFileSync('npx', ['eas', 'build:view', id, '--json'], {
    cwd: APP,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }),
);

const arquivos = info.logFiles ?? [];
if (arquivos.length === 0) {
  console.error(`build ${id} não tem log publicado (status: ${info.status})`);
  process.exit(1);
}

for (const url of arquivos) {
  const resposta = await fetch(url);
  const bruto = Buffer.from(await resposta.arrayBuffer());
  const texto = descomprimir(bruto);

  const mensagens = texto
    .split('\n')
    .filter(Boolean)
    .map((linha) => {
      try {
        return String(JSON.parse(linha).msg ?? '');
      } catch {
        return linha;
      }
    });

  if (tudo) {
    console.log(mensagens.join('\n'));
    continue;
  }

  const primeiro = mensagens.findIndex((m) => SINAIS.test(m));
  if (primeiro === -1) {
    console.log('nenhum erro encontrado — o build pode ter passado. Use --tudo para ver.');
    continue;
  }

  /*
   Uma janela em volta do primeiro sinal, e não só a linha.

   O Gradle diz "Execution failed for task X" numa linha e **o motivo** nas
   seguintes; imprimir só a que casou com o padrão devolveria o nome da tarefa
   sem a explicação — que é exatamente o que o EAS já faz de errado.
  */
  console.log(mensagens.slice(Math.max(0, primeiro - 3), primeiro + 25).join('\n'));
}

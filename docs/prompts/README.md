# Prompts de delegação

Cada arquivo aqui é um prompt **pronto para colar** num terminal/agente novo.
São autocontidos: o agente que receber não precisa ter visto esta conversa.

## Como usar

1. Abra um terminal novo no Maestri (ou um chat novo)
2. Cole o conteúdo do arquivo inteiro
3. O agente lê `docs/ARCHITECTURE.md` e `docs/ROADMAP.md` sozinho — está no prompt

## Regras que valem para todos os squads

- **Branch por tarefa.** `f0/core-fundacao`, `f1/mobile-timer`, etc. Nunca commitar direto na `main`.
- **PR pequeno.** Se passar de ~400 linhas de diff, quebre.
- **Teste junto com o código.** A partir da Fase 0 existe CI: PR sem teste não passa.
- **Não inventar escopo.** Se achar um problema fora da tarefa, abre issue e segue.
- **Não mexer no schema sem avisar o squad Core.** O banco ainda é compartilhado com outro produto (ver `ARCHITECTURE.md §5`).

## Ordem de execução

| Prompt | Squad | Depende de |
|---|---|---|
| `F0-core-fundacao.md` | Core | — |
| `F0-observabilidade-analytics.md` | Core | — (paralelo) |
| `F1-dados-curriculo.md` | IA/Dados | F0 (CI) |
| `F1-core-sessao-servidor.md` | Core | F0 (CI) |
| `F1-mobile-timer-vivo.md` | Mobile | F1 core (contrato da API) |

Prompts das Fases 2–6 são escritos quando a fase anterior fechar — escrever
agora seria adivinhar em cima de decisões que ainda não tomamos.

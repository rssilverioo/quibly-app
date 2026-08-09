# `foco-profundo` — bloquear os outros apps durante a sessão

Só iOS 16+. Ver `src/index.ts` para por que o Android não entra.

## O requisito que organiza tudo

**O escudo não pode sobreviver à sessão.** Um escudo esquecido não é incômodo:
é o telefone da pessoa inutilizado até ela descobrir sozinha que a saída fica no
Tempo de Uso, nos Ajustes — ou apagar o Quibly.

Nenhuma garantia sozinha basta, então são quatro, independentes:

| # | Garantia | Cobre | Falha quando |
|---|----------|-------|--------------|
| 1 | O JS chama `pararFoco()` no fim | O caso comum | O app morre antes |
| 2 | `DeviceActivityMonitor.intervalDidEnd` | App encerrado pelo usuário ou pelo iOS | Janela < 15 min (a Apple recusa) |
| 3 | `reconciliarFoco()` na abertura e no foreground | Reinício do aparelho, crash, extensão que não acordou | A pessoa não abre o app |
| 4 | Teto de 4h em `EstadoDoFoco` | Todo o resto | — |

As três primeiras podem falhar sozinhas. As quatro juntas não têm buraco comum:
a (3) não depende de processo nenhum ter sobrevivido, e a (4) não depende de
código nosso rodar na hora certa.

## Três processos, um contrato

`EstadoDoFoco.swift` é compilado no app e nas **duas** extensões, e os três se
coordenam por dois literais: o nome da loja de ajustes e o do App Group.

Divergir não quebra a compilação — o app levanta uma loja, o monitor derruba
outra, e o telefone fica bloqueado sem prazo. `lib/foco-contrato.test.ts` troca
essa falha silenciosa por uma vermelha.

## O que não dá para fazer

Os tokens de app são opacos. Não dá para listar o que está instalado, saber que
app é cada token, nem escrever "bloqueie o Instagram". Dá para bloquear **tudo**
— que é o pedido — e abrir exceções que a pessoa escolhe num seletor do sistema
cujo resultado nunca vemos.

## O que ainda falta

- O botão no pomodoro (`app/session/`) que liga isto.
- O `CANCEL (10)` — desistir do foco com dez segundos de atrito, como o Focus
  Friend. Sem ele a única saída é esperar ou ir aos Ajustes.
- O ícone `CoelhoEscudo` no asset catalog do alvo `foco-escudo`.
- Verificação em **aparelho real**: Family Controls não funciona no simulador,
  porque depende do Tempo de Uso.

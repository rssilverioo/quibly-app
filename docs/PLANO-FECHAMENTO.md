# Plano de fechamento — do que existe ao que funciona

> Escrito em 2026-07-31. Complementa `DIRECAO-PRODUTO.md`, que define o **quê**.
> Este define a **ordem** e, principalmente, o **critério de pronto**.

---

## O problema com o estado atual

Construímos muito e verificamos pouco. Existe backend publicado, existem telas,
existe marca — e **ninguém nunca postou uma foto e viu ela aparecer no feed**.

Enquanto isso não acontecer, não sabemos se temos um produto ou uma casca bem
organizada. Todo item abaixo está ordenado por essa lógica: primeiro provar que
o loop fecha, depois deixá-lo bonito.

**Regra que vale para as cinco etapas:** nada é "pronto" porque foi commitado.
É pronto quando alguém **viu funcionar na tela**.

---

## Etapa 1 — Recuperar a capacidade de verificar `bloqueia tudo`

Hoje o dono do produto é o único que consegue ver o app. Ele reporta, eu leio
código, teorizo, mando corrigir, ele olha de novo. Cada volta custa o tempo dele
e não converge — foi assim que a capa levou três rodadas.

| Entrega | Pronto quando |
|---|---|
| App abrindo no simulador de desenvolvimento | print da tela de salas sai sem intervenção do dono |
| Um caminho de navegação automatizável | dá para chegar na sala e no desafio sem toque manual |

**Sem isto, as etapas seguintes repetem o mesmo desperdício.**

---

## Etapa 2 — Provar que o loop fecha `a única que importa`

> **Tirar uma foto → ela aparece no feed da sala.**

É o teste que separa produto de casca. O caminho existe dos dois lados e a API
está publicada, mas **nunca foi exercitado ponta a ponta** — e o upload passa
por storage, que ninguém tocou nesta sessão.

| Entrega | Pronto quando |
|---|---|
| Upload da foto funcionando | a imagem chega ao storage e volta uma URL |
| Post aparecendo no feed | a foto é visível no feed, **não** um retângulo cinza com ícone de câmera |
| Linha compacta com miniatura | thumbnail, título, autor e hora, como na referência |

⚠️ O defeito a evitar tem nome e endereço: `feed/[id].tsx:381` mostrava
"prova enviada" com ícone de câmera e **nunca exibia a foto**. Se repetirmos
isso, a funcionalidade não existe — a foto *é* o produto.

---

## Etapa 3 — Fechar as telas especificadas `depois que o loop provar`

Tudo aqui já foi especificado contra referência real do GymRats. Nenhum item
depende de decisão nova.

| Entrega | Depende de |
|---|---|
| `Details` completo: progresso, datas, descrição, avatares, contagem | deploy do backend, já commitado |
| Coelho branco substituindo o castelo em todas as superfícies | plano da marca, pedido |
| Capa reenquadrada | feito, falta ver |
| Presença ao vivo na sala em modo estudo | deploy do backend, já commitado |

---

## Etapa 4 — O que nunca foi começado

| Entrega | Nota |
|---|---|
| Chat ligado ao modelo novo | o código antigo existe em `app/league/chat/` |
| Modo estudo completo | timer dentro da sala + faixa "estudando agora" |
| Entrar por link | `+native-intent` mapeando `/join/:code`; hoje o link abre o app e não vai a lugar nenhum |

---

## Etapa 5 — Pagar a dívida que esta sessão criou

Nenhum destes aparece na tela. Todos cobram juros.

| Dívida | Risco |
|---|---|
| **47 commits do mobile sem merge** | todo o trabalho visual do dia numa branch só; se a árvore se perder, perde-se o dia |
| **Três worktrees extras, ~4 GB** | o disco já encheu uma vez hoje e travou a sessão inteira |
| **QA pausada** | nada construído depois da pausa passou por revisão — e foi justamente o período de maior velocidade |
| **`DIRECAO-PRODUTO.md` sem commit** | o documento do qual tudo deriva existe como arquivo solto, copiado à mão entre quatro árvores |

---

## O que eu faria diferente, registrado para não repetir

**Verificar antes de mostrar.** Mandei prints para o dono julgar em vez de
comparar com a referência primeiro. Ele virou o controle de qualidade.

**Instrução com número, não com adjetivo.** "Ocupa o espaço inteiro" virou tela
cheia. "Proporção 16:9, teto de 170px" não teria virado.

**Referência real desde o começo.** As screenshots da conta do próprio dono
valeram mais que tudo que inferimos das imagens da App Store — e chegaram
tarde.

**Não delegar correção de uma linha.** A capa custou três rodadas de delegação;
quando assumi, levou dois minutos.

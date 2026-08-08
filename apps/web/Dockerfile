# Como o Dokploy constrói e serve o **site** (e, com ele, o painel de admin).
#
# ## Por que Dockerfile aqui, e nixpacks na API
#
# O `nixpacks.toml` da raiz é da API: ele roda `nest build` e sobe
# `apps/api/dist/main.js`. Nixpacks lê um arquivo só, na raiz do repositório, e
# não há como dizer "para este serviço, leia outro". Se o site subisse pelo
# mesmo caminho, construiria a API e a serviria no lugar do site.
#
# Um Dockerfile por aplicação resolve isso sem tocar no que já funciona: no
# Dokploy, este serviço se configura como **Dockerfile**, com o caminho
# `apps/web/Dockerfile` e o contexto na **raiz do repositório** — o build
# precisa do `package-lock.json` e de `packages/shared`, que estão fora de
# `apps/web`.
#
# ## O detalhe que estraga tudo se passar batido
#
# `NEXT_PUBLIC_*` **não** é lida em runtime. O Next assa esses valores dentro do
# bundle do navegador durante o `next build`. Defini-las só como variável de
# ambiente do contêiner faz o site subir com `undefined` em todas elas, sem
# nenhum erro de build — o sintoma aparece só no navegador, como um site que
# não fala com a API.
#
# Por isso cada uma é `ARG` antes de ser `ENV`: no Dokploy elas vão em **Build
# Args**, não (só) em Environment. As sete são públicas por definição — as
# mesmas já estão em texto puro no `eas.json` — então nenhuma credencial passa
# por aqui.

FROM node:22-alpine AS base

# ── dependências ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
# Só os manifestos primeiro: enquanto eles não mudarem, o Docker reaproveita a
# camada de instalação e o deploy não repete um `npm ci` inteiro por causa de
# uma linha de CSS.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# `npm ci` na raiz instala todos os workspaces. É mais do que o site precisa, e
# é o preço de um lockfile só — que é o que garante que o deploy usa exatamente
# as versões que o CI testou. Mesmo raciocínio do `nixpacks.toml`.
RUN npm ci

# ── build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w packages/shared
RUN npm run build -w apps/web

# ── runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuário sem privilégio: o processo não tem nada a fazer como root, e um
# contêiner de servidor web é o lugar mais exposto que temos.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# `output: 'standalone'` (em `next.config.mjs`) monta em `.next/standalone` um
# `server.js` com só as dependências que o site realmente usa — sem ele seria
# preciso arrastar o `node_modules` inteiro do monorepo para dentro da imagem.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
# `0.0.0.0` e não `localhost`: dentro do contêiner, escutar só em loopback
# significa que nada de fora alcança o processo.
ENV HOSTNAME=0.0.0.0

# O `standalone` preserva a árvore do monorepo, então o servidor do site fica
# sob `apps/web`, e não na raiz da imagem.
CMD ["node", "apps/web/server.js"]

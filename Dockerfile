FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install all dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# Build shared package
COPY packages/shared/ packages/shared/
RUN npm run build --workspace=packages/shared

# Generate Prisma client + Build API
COPY apps/api/ apps/api/
COPY turbo.json ./
RUN ./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# ── Production image ──
FROM node:22-slim AS production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/apps/api/package.json apps/api/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist/ packages/shared/dist/
COPY --from=build /app/apps/api/dist/ apps/api/dist/
COPY --from=build /app/apps/api/prisma/ apps/api/prisma/
COPY --from=build /app/node_modules/.prisma/ node_modules/.prisma/

EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]

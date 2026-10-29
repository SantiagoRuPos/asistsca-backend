# syntax=docker/dockerfile:1

# pnpm-lock.yaml es lockfileVersion 9.0 -> se fija una version de pnpm que
# lo entiende (via corepack, sin depender de que la imagen base ya la
# traiga). python3/make/g++ son para que bcrypt pueda compilar su addon
# nativo si no hay un binario precompilado para esta plataforma (alpine
# usa musl, no siempre hay binario listo) -- solo existen en las etapas de
# instalacion, no llegan a la imagen final.

# ---- Etapa 1: dependencias completas (incluye devDependencies, hacen
# falta para "nest build") ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Etapa 2: build (TypeScript -> dist/) ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm run build

# ---- Etapa 3: solo dependencias de produccion ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Etapa 4: runtime ----
# Imagen final sin herramientas de compilacion ni devDependencies -- solo
# lo que el proceso en ejecucion necesita.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json data-source.cjs ./
COPY storage ./storage
COPY uploads ./uploads

# storage/ y uploads/ se montan como volumenes en docker-compose.yml (ver
# ese archivo) -- lo que se copia aqui es solo el contenido inicial
# (storage/licencia/public-key.pem, carpetas de uploads) con el que Docker
# puebla el volumen la primera vez que se crea. Quedan a nombre del usuario
# "node" (ya viene en la imagen oficial, no root) para que el proceso en
# ejecucion pueda escribir ahi sin problemas de permisos.
RUN chown -R node:node /app/storage /app/uploads
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=20s \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(0)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]

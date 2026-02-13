# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=scalpel-npm-deps,target=/root/.npm,sharing=locked \
  npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=scalpel-npm-prod,target=/root/.npm,sharing=locked \
  npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV SCALPEL_WORKSPACE_ROOT=/workspace

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

VOLUME ["/workspace"]
CMD ["dist/index.js"]

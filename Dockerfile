# Stage 1: Workspace
FROM node:20-alpine AS workspace
WORKDIR /srv/app
USER root

COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./

COPY src ./src

RUN npm run build

# Stage 2:
FROM node:20-alpine
WORKDIR /srv/app
USER root

COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci --omit=dev

COPY --from=workspace /srv/app/dist ./dist

USER 1000
ARG CAPROVER_GIT_COMMIT_SHA=dev
ENV COMMIT=$CAPROVER_GIT_COMMIT_SHA
ENV NODE_ENV=production

ENTRYPOINT ["node", "--expose-gc", "dist/index.js"]

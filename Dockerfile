FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      ca-certificates \
      openjdk-17-jre-headless \
      tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node lib ./lib
COPY --chown=node:node public/samples ./public/samples

ENV NODE_ENV=production \
    PAPERPLAIN_MODE=hosted \
    PORT=10000 \
    NODE_OPTIONS=--max-old-space-size=128 \
    JAVA_TOOL_OPTIONS="-Xms32m -Xmx320m -XX:+ExitOnOutOfMemoryError -Djava.io.tmpdir=/tmp"

USER node

EXPOSE 10000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.mjs"]

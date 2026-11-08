# Build only the runtime dependency required by the standalone PvP server.
# The repository's main package lock is maintained by the web/Android toolchain;
# keeping this tiny image independent avoids installing the game's build stack.
FROM node:24-alpine AS runtime-deps
WORKDIR /deps
RUN npm init -y \
  && npm install --omit=dev --no-package-lock --no-audit --no-fund ws@8.22.1

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=runtime-deps /deps/node_modules ./node_modules
COPY package.json ./package.json
COPY src ./src

EXPOSE 8080

CMD ["npm", "run", "pvp:server"]

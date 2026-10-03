# Northflank / any container host build for «Шахта», as in See Escape.
# Stage 1 builds the Vite bundle; the runtime needs only Node and the built dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine

# PORT is deliberately not pinned here: with it unset the server binds both
# 8080 and 3000, so whichever port the host routes to reaches the app. Set
# PORT (or PORTS, comma-separated) to override.
ENV NODE_ENV=production \
    HOST=0.0.0.0

WORKDIR /app

# server.js uses only Node built-ins, so the runtime image carries no node_modules.
COPY package.json server.js quiz-generation.cjs ./
COPY --from=build /app/dist ./dist

USER node
EXPOSE 8080 3000

CMD ["node", "server.js"]

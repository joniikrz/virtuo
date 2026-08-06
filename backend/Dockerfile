# 1. Stage për build-in e Node/Express & Prisma
FROM node:24-alpine AS build

WORKDIR /app

# Këtu duhet openssl sepse këtu është Prisma!
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN ./node_modules/.bin/prisma generate

COPY . .
RUN npm run build

# Prisma CLI dhe dev dependencies ekzistojnë vetëm në container-in njëpërdorimësh të migrimit.
FROM build AS migrator
RUN chown -R node:node /app
USER node

# Hiqi mjetet e build/test nga dependencies që kalojnë në API-n production.
FROM build AS production-dependencies
RUN npm prune --omit=dev

# 2. Stage për ekzekutimin në Production
FROM node:24-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "dist/index.js"]

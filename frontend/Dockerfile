FROM node:20-alpine AS build

WORKDIR /app

# 1. Instalojmë OpenSSL dhe libc6-compat që të punojë Prisma Engine në Alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Instalojmë OpenSSL edhe në stage-in përfundimtar
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm install --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 5000

CMD ["node", "dist/index.js"]
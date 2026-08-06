# 1. Stage për build-in e Node/Express & Prisma
FROM node:20-alpine AS build

WORKDIR /app

# Këtu duhet openssl sepse këtu është Prisma!
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

# 2. Stage për ekzekutimin në Production
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/index.js"]

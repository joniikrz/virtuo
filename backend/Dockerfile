# 1. Përdorimi i imazhit zyrtar të Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Kopjimi i paketave të varësive
COPY package*.json ./
RUN npm install

# Kopjimi i skedarëve të projektit dhe schema.prisma
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Gjenerimi i Prisma Client dhe ndërtimi i projektit (build)
RUN npx prisma generate
RUN npm run build

# 2. Faza e ekzekutimit (Run stage) për të pasur një imazh sa më të lehtë
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

# Kopjimi i skedarëve të ndërtuar nga faza e parë
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Krijimi i dosjes për uploads lokale të skedarëve
RUN mkdir -p /app/uploads

EXPOSE 5000

# Nisja e serverit duke u siguruar që të ekzistojë Prisma client i gjeneruar
CMD npx prisma db push --accept-data-loss && node dist/index.js

# 1. Stage për build-in e React/Vite
FROM node:24-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && find dist -type f \( -name '*.map' -o -name '*.ts' -o -name '*.tsx' \) -delete

# 2. Stage për shërbimin me Nginx (pa privilegje, për OpenShift)
FROM docker.io/nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

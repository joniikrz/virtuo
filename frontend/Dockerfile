# 1. Stage për build-in e React/Vite
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2. Stage për shërbimin me Nginx
FROM nginx:alpine

# Kopjimi i dist-it të frontend-it në Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Kopjimi i konfigurimit të Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

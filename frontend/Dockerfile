# 1. Ndërtimi i aplikacionit React (Build stage)
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. Shërbimi i skedarëve me Nginx (Production stage)
FROM nginx:alpine

# Kopjimi i build-it të React
COPY --from=build /app/dist /usr/share/nginx/html

# Kopjimi i konfigurimit të personalizuar të Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

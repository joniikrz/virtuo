# Virtuo Task Manager

Dokumentimi i arkitekturës: [Hexagonal Architecture (Ports & Adapters)](docs/ARCHITECTURE.md)

Virtuo është aplikacion full-stack për menaxhimin e hapësirave private dhe detyrave të ekipit.

## Teknologjitë

- Backend: Node.js, Express, Prisma ORM
- Database: PostgreSQL 16
- Frontend: React, TypeScript, Vite
- Infrastrukturë: Docker Compose dhe Nginx
- Autentikim: JWT në cookie `httpOnly`

## Nisja e shpejtë

Kopjoni konfigurimin shembull:

```bash
cp .env.example .env
```

Vendosni vlera të sigurta për:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- `BACKUP_ENCRYPTION_KEY`, nëse aktivizohen backup-et

Vendosni certifikatën sipas [docs/SECURITY.md](docs/SECURITY.md), pastaj validoni dhe nisni aplikacionin me HTTPS:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.tls.yml ps
```

Aplikacioni duhet të publikohet me HTTPS. Udhëzimet dhe overlay-i TLS janë te [docs/SECURITY.md](docs/SECURITY.md).

## Përditësimi në VM

```bash
cd ~/virtuo
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.tls.yml config --quiet
sudo docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
sudo docker compose -f docker-compose.yml -f docker-compose.tls.yml ps
```

Shërbimi `migrate` përditëson schema-n dhe inicializon rolet para nisjes së backend-it.

## Shkallëzimi

Backend-i është stateless dhe mund të ekzekutohet me disa replica:

```bash
docker compose up -d --scale backend=3
```

Mbani numrin total të lidhjeve nën kufirin e PostgreSQL:

```text
backend replicas × DB_CONNECTION_LIMIT <= POSTGRES_MAX_CONNECTIONS - 20
```

## Backup-et

Pas vendosjes së `BACKUP_ENCRYPTION_KEY`, aktivizoni backup-in e enkriptuar:

```bash
mkdir -p backups
docker compose --profile backup up -d backup
docker compose logs -f backup
```

Backup-et e databazës dhe uploads ruhen në `./backups`. Kopjojini edhe jashtë serverit.

## Dokumentimi production

Udhëzimet e plota për tuning, scale-out, health checks, backup, restore dhe load testing gjenden te [docs/OPERATIONS.md](docs/OPERATIONS.md). Hardening-u, HTTPS, menaxhimi i çelësave dhe enkriptimi në disk dokumentohen te [docs/SECURITY.md](docs/SECURITY.md).

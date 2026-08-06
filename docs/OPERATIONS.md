# Virtuo: Production, Scaling and Recovery

This guide covers the production safeguards included in Virtuo. It does not replace capacity testing for your specific VM and traffic pattern.

## Architecture

- `frontend`: Nginx serves static files, rate-limits abusive traffic and proxies API requests.
- `backend`: stateless Express/Prisma API. It can run as multiple replicas.
- `migrate`: a one-shot service that applies the Prisma schema and seed exactly once before API replicas start.
- `db`: PostgreSQL, reachable publicly only through `127.0.0.1` on the VM.
- `backup`: optional scheduled, encrypted PostgreSQL and upload backups.

The task board uses lightweight summary queries with ETags. Full comments and attachments are loaded only for the open task. This reduces database work and network payload during polling.

## Initial production start

```bash
cp .env.example .env
openssl rand -hex 32
```

Put independent, long random values in `.env` for `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD` and `BACKUP_ENCRYPTION_KEY`. Keep `.env` and the encryption key outside Git and in a second secure location.

Validate and start:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1/health/ready
```

## Scale the API

The backend has no public port and stores persistent uploads in a shared Docker volume, so it can be replicated behind Nginx:

```bash
docker compose up -d --scale backend=3
docker compose ps
```

Use this connection budget:

```text
backend replicas × DB_CONNECTION_LIMIT <= POSTGRES_MAX_CONNECTIONS - 20
```

Example: 3 replicas × 10 connections = 30, safely below the default PostgreSQL limit of 200. Do not increase connection limits blindly; too many active PostgreSQL connections can reduce performance.

For multiple VMs, move uploads to object storage or a shared filesystem, use a managed/load-balanced PostgreSQL service, and put an external load balancer in front of the Nginx instances.

## Capacity test

Run load tests against staging, not against an active production database. The included dependency-free test can exercise health or an authenticated read endpoint:

```bash
LOAD_TEST_CONCURRENCY=50 LOAD_TEST_SECONDS=60 node scripts/load-test.mjs http://127.0.0.1/health/ready
```

For an authenticated endpoint, provide the session cookie through the environment variable `LOAD_TEST_COOKIE`; do not paste production tokens into scripts or Git. Track p95/p99 latency, error rate, CPU, memory and PostgreSQL slow queries together. Increase replicas only after identifying whether the bottleneck is API CPU, database I/O/connections or network payload.

## Database performance

The Prisma schema includes indexes for the real access paths: space membership, task ownership/assignment/status/deadline, task comments/attachments, unread notifications and activity history.

PostgreSQL logs queries slower than `POSTGRES_SLOW_QUERY_MS` (default 500 ms). Inspect them with:

```bash
docker compose logs db --since 30m | grep "duration:"
```

Tune `shared_buffers` and `effective_cache_size` to the VM memory. The defaults are conservative for a small server; do not copy large values to a low-memory VM.

## Encrypted backups

Start the backup profile after setting `BACKUP_ENCRYPTION_KEY`:

```bash
mkdir -p backups
docker compose --profile backup up -d backup
docker compose logs -f backup
```

The service creates two AES-256 encrypted files per run in `./backups`:

- a PostgreSQL custom-format dump;
- an archive of uploaded files.

It also creates SHA-256 checksum files and deletes backups older than `BACKUP_RETENTION_DAYS`. Copy backups off the VM (NAS/object storage/off-site). A backup stored only on the same disk is not disaster recovery.

Test restoration regularly. To restore, stop application writes first and explicitly confirm the destructive operation:

```bash
docker compose stop frontend backend
RESTORE_CONFIRM=YES docker compose --profile restore run --rm restore db /backups/virtuo-db_TIMESTAMP.dump.enc
RESTORE_CONFIRM=YES docker compose --profile restore run --rm restore uploads /backups/virtuo-uploads_TIMESTAMP.tar.gz.enc
docker compose up -d
```

Use matching database and upload backups from the same timestamp. Never test restoration for the first time during an incident.

## Health and safe shutdown

- `/health/live`: confirms that the Node process is alive.
- `/health/ready`: confirms that the API can reach PostgreSQL.

Docker waits for readiness before starting Nginx. During upgrades, the backend handles `SIGTERM`, stops accepting new connections, waits for active requests and then disconnects Prisma.

## Security checklist

- Put TLS in front of port 80 before exposing Virtuo outside the private LAN.
- Restrict SSH and port 80/443 with the VM firewall.
- PostgreSQL is bound to `127.0.0.1`, not the LAN interface.
- Keep Docker, PostgreSQL and the base images patched.
- Rotate secrets and backup keys under a documented schedule.
- Monitor disk space, memory, container restarts, HTTP 5xx rates and PostgreSQL slow queries.
- Load-test a staging environment before a large rollout.

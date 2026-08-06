# Siguria e Virtuo

Asnjë aplikacion nuk mund të premtojë se është i pathyeshëm. Ky konfigurim ul ndjeshëm sipërfaqen e sulmit, por siguria kërkon përditësime, monitorim dhe menaxhim të kujdesshëm të çelësave.

## Çelësat dhe fjalëkalimet

- Mos e dërgo skedarin `.env` në Git dhe mos i vendos çelësat në screenshot-e ose logje.
- Gjenero vlera të ndryshme për secilin sekret:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # POSTGRES_PASSWORD
openssl rand -base64 48   # BACKUP_ENCRYPTION_KEY
```

- Fjalëkalimet dhe kodet e rikuperimit ruhen vetëm si hash bcrypt. Ato nuk duhen enkriptuar në mënyrë të kthyeshme.
- Ndërro çelësat menjëherë nëse dyshon se janë ekspozuar. Ndërrimi i `JWT_SECRET` i çkyç të gjithë përdoruesit.
- Përdor `BCRYPT_ROUNDS=12`, `COOKIE_SECURE=true` dhe `ALLOW_INITIAL_SETUP=false` në production.

## HTTPS i detyrueshëm në production

Vendos një certifikatë të besuar dhe çelësin privat jashtë Git-it:

```text
secrets/tls/fullchain.pem
secrets/tls/privkey.pem
```

Për rrjet lokal mund të përdoret një CA e organizatës ose `mkcert`; CA-ja duhet instaluar si e besuar në pajisjet e ekipit. Pastaj në `.env`:

```env
FRONTEND_URL=https://virtuo-tasks.local
COOKIE_SECURE=true
HTTPS_PORT=443
```

Nise me overlay-in TLS:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Porti 80 ridrejton me status 308 në HTTPS. Konfigurimi lejon vetëm TLS 1.2/1.3 dhe dërgon HSTS e header-at mbrojtës.

## Enkriptimi në disk dhe backup-et

- Aktivizo enkriptimin e plotë të diskut/volume-it të VM-së (p.sh. LUKS) sepse databaza dhe attachments duhet të mbrohen edhe kur serveri është i fikur.
- Backup-et e Virtuo enkriptohen me AES-256 dhe autentikohen me HMAC-SHA256. Restore refuzohet kur mungon HMAC-i, skedari është ndryshuar ose çelësi është gabim.
- Mbaj një kopje jashtë serverit dhe testo restore-in rregullisht. Ruaje `BACKUP_ENCRYPTION_KEY` veçmas nga backup-i.

## Operimi

- Ekspozo vetëm 80/443; PostgreSQL është i lidhur vetëm në `127.0.0.1` dhe nuk duhet hapur në firewall.
- Ekzekuto `npm audit` para release-it dhe përditëso imazhet/dependencies çdo muaj.
- Monitoro dështimet e login-it, përgjigjet 429/5xx, diskun, certifikatat dhe backup-et.
- Jep qasje SSH me çelësa, çaktivizo login-in me password dhe kufizo `sudo`.
- Mos ruaj të dhëna sensitive në tituj, komente ose emra skedarësh pa një politikë të qartë të kompanisë.


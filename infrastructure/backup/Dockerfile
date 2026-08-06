FROM postgres:16-alpine

RUN apk add --no-cache openssl tzdata

COPY backup-loop /usr/local/bin/backup-loop
COPY restore-backup /usr/local/bin/restore-backup
RUN chmod 0755 /usr/local/bin/backup-loop /usr/local/bin/restore-backup

CMD ["/usr/local/bin/backup-loop"]

# Virtuo — Hexagonal Architecture

Backend-i përdor **Ports & Adapters**. Varësitë duhet të drejtohen gjithmonë nga jashtë drejt bërthamës:

```text
HTTP / Express ──> Application use-cases ──> Domain
                         │
                         v
                    Port interfaces
                         ▲
                         │
              Prisma / SMTP / filesystem adapters
```

## Folderët

- `backend/src/domain`: rregulla dhe tipe të biznesit pa Express, Prisma ose I/O.
- `backend/src/application`: use-cases dhe port interfaces. Nuk njeh framework apo databazë.
- `backend/src/adapters/outbound`: implementime konkrete të porteve (p.sh. Prisma).
- `backend/src/routes` dhe `backend/src/middleware`: HTTP inbound adapters ekzistues. Këta përkthejnë HTTP në input të use-case dhe output në HTTP.
- `backend/src/composition-root.ts`: lidh portet me adapters konkretë. Vetëm këtu zgjidhen implementimet.

## Rregullat

1. `domain` nuk importon nga `application`, adapters, Express, Prisma, SMTP ose filesystem.
2. `application` mund të importojë vetëm `domain` dhe portet e veta.
3. Adapters implementojnë portet; nuk vendosin rregulla të autorizimit të biznesit.
4. HTTP status codes, cookies dhe headers mbeten në inbound adapter.
5. Çdo use-case testohet me fake ports, pa databazë ose server.
6. Endpoint-et e vjetra ruhen gjatë migrimit; route logic zhvendoset gradualisht në use-cases.

Testi `architecture.test.ts` e bllokon automatikisht importimin e framework-eve në bërthamë.

## Siguria e frontend-it

Kodi React dërgohet në browser dhe nuk mund të jetë sekret. Production build:

- minifikohet;
- nuk prodhon source maps;
- nuk publikon `.ts`, `.tsx` ose `.map`;
- nuk përmban secrets ose kontrolle autorizimi vendimtare.

Të gjitha lejet dhe filtrimi i të dhënave zbatohen përsëri në backend.


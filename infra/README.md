# Rapih — local infra

`docker compose -f infra/docker-compose.dev.yml up -d` boots a local Postgres for development and tests.

- Host: `localhost`
- Port: `5433`
- User / password / db: `rapih` / `rapih` / `rapih`
- Test DB: same instance, db `rapih_test` (created on first migrate by `apps/api` test setup)

Tear down: `docker compose -f infra/docker-compose.dev.yml down`. Add `-v` to wipe data.

In production (Dokploy) Postgres is a managed service and this file is not used.

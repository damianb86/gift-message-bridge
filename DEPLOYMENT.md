# Docker Deployment

This app is designed to run with shared infrastructure outside the app folder:

- `../../shared-docker`: one Caddy Docker Proxy container, one PostgreSQL
  container, one shared Docker network.
- `./docker-compose.yml`: this app container plus a one-shot `db-init` job that
  creates this app's database and role in the shared PostgreSQL container.

Do not start Caddy or PostgreSQL from this app folder. That would create
duplicate infra containers when more apps are deployed.

## First Server Setup

From the shared infra folder:

```sh
cd ../../shared-docker
cp .env.example .env
nano .env
docker compose up -d
```

## Deploy This App

From this app folder:

```sh
cp .env.example .env
nano .env
./deploy.sh
```

The deploy script reads both env files:

- `../../shared-docker/.env` for shared PostgreSQL admin access.
- `./.env` for this app's Shopify, SMTP, domain, and database settings.

## Deploy Production From Local Build

To avoid running the React Router/Vite build on the production server, build the
bundle locally and upload only the runtime files:

```sh
PEM_FILE=/path/to/ssh.pem ./deploy-production.local.sh
```

The local deploy script:

- loads `.env.production`, `.production`, or `.env` for the local build;
- runs `npm run build:production`;
- uploads `build/`, `prisma/`, `scripts/`, `docker/`, `Dockerfile`,
  `docker-compose.yml`, `deploy.sh`, and package files to the server;
- runs `APP_ENV_FILE=.env BUILD_APP_BUNDLE=0 ./deploy.sh` remotely.

Override defaults when needed:

```sh
REMOTE_HOST=1.2.3.4 \
REMOTE_APP_DIR=/opt/apps/gift-message-bridge-lite \
PEM_FILE=/path/to/ssh.pem \
./deploy-production.local.sh
```

## Add Another App

For each new app:

- Use a unique `COMPOSE_PROJECT_NAME`.
- Use a unique `APP_HOST`.
- Use a unique `APP_DB_NAME` and `APP_DB_USER`.
- Keep `DATABASE_URL` pointed at `postgres`, never `localhost`.
- Keep a low Prisma `connection_limit`, such as `3`, on this small server.

Caddy discovers the app from Docker labels, so there is no shared Caddyfile to
edit for each app.

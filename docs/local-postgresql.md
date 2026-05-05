# Local PostgreSQL

Gift Message Bridge Lite uses Prisma with PostgreSQL. For local Shopify CLI development, keep the app pointed at the Homebrew PostgreSQL service on `127.0.0.1:5432`.

Required local values:

```bash
DATABASE_URL=postgresql://qorve_dev:<local-password>@127.0.0.1:5432/gift_message_bridge_lite?schema=public
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
APP_DB_NAME=gift_message_bridge_lite
APP_DB_USER=qorve_dev
```

The local `.env` file is intentionally ignored by Git. Do not commit database passwords, Shopify API secrets, or SMTP credentials.

Docker Compose still uses the `postgres` hostname from the app container network. Use the Docker override shown in `.env.example` only when running the full Compose stack.

Useful checks:

```bash
brew services list
psql "$DATABASE_URL" -c "select current_user, current_database();"
npx prisma migrate deploy
npm run dev
```

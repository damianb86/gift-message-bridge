#!/bin/sh
set -eu

psql \
  -v ON_ERROR_STOP=1 \
  -v app_password="$GIFT_MESSAGE_BRIDGE_DB_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<-EOSQL
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  'gift_message_bridge_lite',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gift_message_bridge_lite'
)\gexec

SELECT 'CREATE DATABASE gift_message_bridge_lite OWNER gift_message_bridge_lite'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'gift_message_bridge_lite'
)\gexec

GRANT ALL PRIVILEGES ON DATABASE gift_message_bridge_lite TO gift_message_bridge_lite;
EOSQL

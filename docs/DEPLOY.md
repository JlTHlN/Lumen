# Deploying with Portainer (Proxmox / Docker)

## 1. Files you need

```
Dockerfile
docker-compose.yml
.dockerignore
src/            (the app)
public/
package.json
package-lock.json
```

Everything else (`.git`, `node_modules`, `.next`) is excluded by `.dockerignore`.

## 2. Portainer → Stacks → Create stack

Paste `docker-compose.yml` into the web editor, then set **APP_SECRET** under
*Environment variables* before deploying:

| Variable     | Required | Notes                                                                                               |
| ------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `APP_SECRET` | yes      | Any long random string. Set it once and **never change it** — saved API keys are encrypted with it. |
| `TZ`         | no       | e.g. `Europe/London`                                                                                |

Then click **Deploy the stack**.

## 3. What happens on first boot

The app creates its own database tables. There is **no migration command to run**.
On startup the container:

1. waits for Postgres to accept connections (up to 60 s),
2. creates any missing tables, indexes and foreign keys,
3. logs `[startup] database ready, schema verified`.

So a brand new volume goes from empty to working with no manual steps.

## 4. Checking it worked

- **Portainer → Containers** — `media-tracker` should show `healthy` (green).
- Open `http://<host>:3050/api/health`. You want:

```json
{ "status": "ok", "database": "connected", "schema": "ready" }
```

- In the app, **Settings** shows a **System** card with the same status.

If `schema` is `"missing"`, restart the `app` container — it will run setup again.

## 5. Common problems

### Dashboard won't load / settings won't save

`/api/health` will say `"schema": "missing"`. Restart the `app` container
(**Containers → media-tracker → Restart**). Setup is idempotent, so this is safe
to repeat and never touches existing data.

### Container keeps restarting

Check **Logs** for `[startup] gave up waiting for the database`. That means the
`db` service never became ready — usually a wrong password or database name in
`DATABASE_URL`.

### Port already in use

Change the host side only: `"3051:3000"`. Leave the container side as `3000`.

### API keys disappeared after an update

`APP_SECRET` changed. Provider keys are encrypted with it, so a different secret
makes them unreadable (the app degrades gracefully and shows them as not
configured). Re-enter them in **Settings → Providers**. Your library, ratings and
lists are unaffected.

## 6. Updating

```bash
docker compose build --no-cache app
docker compose up -d
```

Or in Portainer: **Stacks → your stack → Editor** (paste the new compose) →
**Update the stack**, with *Re-pull image and redeploy* enabled.

Schema changes are applied automatically on the next boot.

## 7. Backups

Your data lives in the `postgres_data` volume:

```bash
docker exec media-tracker-db pg_dump -U postgres mediatracker > lumen-backup.sql
```

Restore with:

```bash
cat lumen-backup.sql | docker exec -i media-tracker-db psql -U postgres -d mediatracker
```

You can also export JSON/TXT from **Settings → Data**. Those files contain your
library, ratings and external IDs; provider metadata is re-fetched on import, so
backups stay small.

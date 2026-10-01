# Lumen

A self-hosted diary for everything you watch and play — movies, TV shows, anime
and games. Mobile-first, dark, purple, and entirely yours: no account, no cloud,
no telemetry.

## Features

- **Track anything** — one tap to add a title; everything else is optional
- **Episode-level TV tracking** — per-episode ticks, season bulk actions, live progress
- **Up Next & Upcoming** — the next episode of every show you follow, plus announced seasons
- **Badges & streaks** — 24 achievements computed from your own history
- **Year in review** — a wrapped-style recap at `/recap`
- **Pick for me** — mood-based suggestions from your watchlist
- **Custom lists**, ratings, likes/dislikes, favourites, notes, playtime
- **Statistics** — hours, favourite genres, rating distribution, fun facts
- **Telegram bot** — search and track titles from your phone
- **Notifications** — Telegram push for new episodes and releases
- **Export/import** — JSON and human-readable TXT; your data is never locked in

## Quick start

```bash
docker compose up -d --build
```

Then open <http://localhost:3050>. The database schema is created automatically
on first boot — there is no migration step to run.

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for Portainer instructions, environment
variables and backups.

## Metadata providers

Lumen ships with a built-in offline catalog so it works immediately. Add keys for
full artwork, episode data and complete search:

| Provider | Used for        | Where to get a key                             |
| -------- | --------------- | ---------------------------------------------- |
| TMDB     | movies, TV      | <https://www.themoviedb.org/settings/api>       |
| IGDB     | games           | <https://dev.twitch.tv/console/apps/create>     |
| RAWG     | games (alt.)    | <https://rawg.io/apidocs>                       |

Keys are entered in **Settings → Providers**, encrypted at rest with
`APP_SECRET`, and never sent to the browser.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Requires `DATABASE_URL` in `.env`. Tables are created on first run.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Game
metadata is provided by IGDB or RAWG. See **About & credits** in the app.

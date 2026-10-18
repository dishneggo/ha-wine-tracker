# Wine Tracker - Home Assistant Add-on & Docker Standalone

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/icon_dark.png">
    <img src="assets/icon_bright.png" alt="Wine Tracker logo" width="160">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.11.0-blue.svg" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license">
  <img src="https://img.shields.io/badge/Home%20Assistant-Add--on-41BDF5.svg?logo=homeassistant&logoColor=white" alt="home assistant add-on">
  <img src="https://img.shields.io/badge/Docker-standalone-2496ED.svg?logo=docker&logoColor=white" alt="docker">
  <img src="https://img.shields.io/github/last-commit/xenofex7/ha-wine-tracker?logo=github" alt="last commit">
  <img src="https://img.shields.io/github/commit-activity/y/xenofex7/ha-wine-tracker?logo=github" alt="commit activity">
</p>

<p align="center">
  <a href="https://xenofex7.github.io/ha-wine-tracker/"><strong>Documentation &amp; Demo</strong></a>
</p>

Wine Tracker manages your wine cellar from label photo to tasting note. Snap a
photo and let AI fill in the details, search Vivino to import ratings and
prices, then track bottles, drink windows and value over time. It runs as a
Home Assistant add-on in the HA sidebar, or as a standalone Docker container
with its own logins.

<details>
<summary>Table of contents</summary>

- [Features](#features)
- [Screenshots](#screenshots)
- [Requirements](#requirements)
- [Installation](#installation)
- [Updating](#updating)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

</details>

## Features

### Wine management

- Wine cards with photo, vintage, type, region, grape variety, rating and notes
- Photo upload straight from your phone
- Star rating (1-5) and quick `+`/`-` quantity buttons on the card
- Duplicate a wine when only the vintage changes
- Bottle formats from Piccolo (0.1875 l) to Nebuchadnezzar (15 l)
- Empty bottles stay as placeholders, toggle to hide them
- Drink window (from/until year) and purchase price in your currency
- Autocomplete for region, grape variety, purchase source and storage location

### AI and integrations

- AI label recognition fills in all fields, including maturity phases, taste
  profile and food pairings (Anthropic, OpenAI, OpenRouter, Ollama, MiniMax,
  Mistral)
- Vivino search by name with ratings, region and price, plus a regional
  fallback chain so country-specific labels actually show up
- Vivino ID management: view, edit and test the wine link in the edit modal
- Reload missing data: re-analyze incomplete wines via AI or Vivino
- AI sommelier chat with full cellar CRUD: ask about your cellar, upload label
  photos, add, edit and delete wines from the conversation, with persistent
  chat history
- Maturity graph as an AI-generated bell curve (Youth, Maturity, Peak, Decline)
- Taste profile and food pairings as body/tannin/acidity/sweetness bars with
  matching dishes

### Views, filters and statistics

- Four cellar view modes: Cards, List, Grid and a sortable Table view
- Quick filter by wine type, vintage and grape variety
- Advanced filter: AND-combined conditions across every field, with text,
  number, choice and drink-window operators and autocomplete in the inputs
- Save filter sets as presets, and make the advanced filter the default one
- Activity timeline of wines added, consumed, restocked or removed
- Interactive 3D globe of your wine regions
- Statistics with donut charts, stock history, total bottles, total liters,
  value overview and average age

### Platform

- Six themes, each with a dark and a light mode
- Seven languages: German, English, French, Italian, Spanish, Portuguese, Dutch
- Fully responsive, with a hamburger menu on narrow viewports
- Home Assistant ingress: embedded in the HA sidebar
- REST API at `/api/summary` for HA sensors
- Backup and restore: export the cellar as a ZIP (JSON + CSV + images) and
  import it back with a duplicate preview
- Per-user logins with read-only accounts in Docker standalone mode

## Screenshots

<p align="center">
  <img src="assets/261018_main_screen.png" alt="Cellar overview" width="800">
</p>
<p align="center">
  <img src="assets/261018_statistics_screen.png" alt="Statistics with globe and charts" width="800">
</p>
<p align="center">
  <img src="assets/261018_add_wine_screen.png" alt="Add a wine via AI, Vivino or manually" width="800">
  <img src="assets/261018_wine_edit_screen.png" alt="Edit wine details" width="800">
</p>

## Requirements

- Home Assistant with the Supervisor (HA OS or Supervised) for the add-on, on
  aarch64, amd64, armhf, armv7 or i386
- Docker 24+ with Compose v2 for the standalone container, on amd64 or arm64
- An API key for one AI provider, only if you want label recognition and the
  sommelier chat. Ollama runs locally and needs no key.
- Everything else, including Vivino search, works without an account

## Installation

### Home Assistant add-on

[![Add Repository to My Home Assistant][my-ha-badge]][my-ha-url]

Or add it manually:

1. Go to **Settings -> Add-ons -> Add-on Store**
2. Top right: **... -> Repositories**
3. Add `https://github.com/xenofex7/ha-wine-tracker`
4. **Wine Tracker** appears in the store
5. Click **Install**, then **Start**

The add-on opens in the HA sidebar under **Wine Tracker**.

### Docker standalone

1. Create a `docker-compose.yml`:

```yaml
services:
  wine-tracker:
    image: ghcr.io/xenofex7/wine-tracker:1.11.0
    ports:
      - "5050:5050"
    volumes:
      - wine-data:/data
    environment:
      - AUTH_ENABLED=true
      - USERS=admin:changeme
      - SECRET_KEY=change-this-to-a-random-string
      - CURRENCY=CHF
      - LANGUAGE=de
    restart: unless-stopped

volumes:
  wine-data:
```

2. Start it:

```bash
docker compose up -d
```

Wine Tracker is now running at `http://localhost:5050`.

For every available option, copy [`.env.example`](.env.example) to `.env` and
reference it with `env_file: .env`, or start from
[`docker/docker-compose.yml`](docker/docker-compose.yml).

## Updating

Export a backup first: **Settings -> Data -> Export backup** writes a ZIP with
the database, the CSV and all images.

Home Assistant add-on: open **Settings -> Add-ons -> Wine Tracker** and click
**Update** when a new version is offered.

Docker standalone: bump the image tag in `docker-compose.yml`, then run

```bash
docker compose pull
docker compose up -d
```

## Configuration

Both deployments share the same settings. The add-on reads them from the
Home Assistant add-on configuration page, the Docker container from
environment variables.

> **AI settings saved in the app win.** Provider, API key, model and chat model
> can also be set under **Settings -> AI**, including a connection test. Those
> values are stored in the database and override both the Home Assistant
> options and the environment variables.

### General

| Option | ENV | Default | Description |
|--------|-----|---------|-------------|
| `currency` | `CURRENCY` | `CHF` | Currency shown with prices. `CHF`, `EUR`, `USD`, `GBP`, `CAD`, `AUD`, `SEK`, `NOK`, `DKK`, `PLN`, `CZK` and `BRL` also pick the Vivino region; any other value falls back to US/USD there. |
| `language` | `LANGUAGE` | `de` | UI language: `de`, `en`, `fr`, `it`, `es`, `pt`, `nl` |

### AI provider

Pick one provider and set its key and model. The AI drives label recognition,
the maturity/taste/food enrichment and the sommelier chat.

| Option | ENV | Default | Description |
|--------|-----|---------|-------------|
| `ai_provider` | `AI_PROVIDER` | `none` | `none`, `anthropic`, `openai`, `openrouter`, `ollama`, `minimax`, `mistral` |
| `anthropic_api_key` | `ANTHROPIC_API_KEY` | _(empty)_ | Key from [console.anthropic.com](https://console.anthropic.com) |
| `anthropic_model` | `ANTHROPIC_MODEL` | `claude-opus-4-8` | Anthropic model identifier |
| `openai_api_key` | `OPENAI_API_KEY` | _(empty)_ | Key from [platform.openai.com](https://platform.openai.com) |
| `openai_model` | `OPENAI_MODEL` | `gpt-5.5` | OpenAI vision model |
| `openrouter_api_key` | `OPENROUTER_API_KEY` | _(empty)_ | Key from [openrouter.ai](https://openrouter.ai) |
| `openrouter_model` | `OPENROUTER_MODEL` | `anthropic/claude-opus-4.8` | Any vision-capable OpenRouter model |
| `ollama_host` | `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `ollama_model` | `OLLAMA_MODEL` | `llama3.2-vision` | Ollama vision model |
| `minimax_api_key` | `MINIMAX_API_KEY` | _(empty)_ | Key from [platform.minimaxi.com](https://platform.minimaxi.com) |
| `minimax_model` | `MINIMAX_MODEL` | `MiniMax-M3` | MiniMax model, vision-capable despite the name |
| `mistral_api_key` | `MISTRAL_API_KEY` | _(empty)_ | Key from [console.mistral.ai](https://console.mistral.ai) |
| `mistral_model` | `MISTRAL_MODEL` | `mistral-medium-latest` | Mistral model, use a Pixtral model for label recognition |
| `chat_model` | `CHAT_MODEL` | _(empty)_ | Separate model for the sommelier chat only. Empty means the chat uses the model above. |

Provider notes:

- **Ollama** runs fully local and needs no key. Pull a vision model with
  `ollama pull llama3.2-vision`. From inside a container, `localhost` is the
  container itself, so point `ollama_host` at `http://host.docker.internal:11434`
  or at the Ollama container name.
- **Mistral** needs a vision model for label recognition, for example
  `mistral-medium-latest` or `pixtral-12b-latest`. Text-only models such as
  `mistral-large-latest` still work for the sommelier chat.
- **MiniMax** speaks the OpenAI-compatible API. `MiniMax-M3` accepts image
  input; the older `MiniMax-VL-01` name is no longer accepted.
- A typical label analysis costs around 2,500 tokens. Check your provider's
  pricing page for current rates.

### Docker environment variables

[`.env.example`](.env.example) lists every variable with inline comments. The
ones you will usually set:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `false` | Enable login (`true` / `false`) |
| `USERS` | _(empty)_ | User list, see the format below |
| `SECRET_KEY` | _(random)_ | Session key. Set a fixed value so logins survive restarts. |
| `DATA_DIR` | `/data/wine-tracker` | Where database and images live inside the container |

**User format:** `user1:password1,user2:password2,guest:password3:readonly`

Users are comma-separated. Each entry is `username:password` for full access or
`username:password:readonly` for view only. Read-only users can browse and
search but cannot add, edit or delete.

### Data persistence

All data lives in a single directory: `/share/wine-tracker/` for the add-on,
the `/data` volume for the Docker container. It holds the SQLite database and
the uploaded images, and survives updates, restarts and Home Assistant updates.

## Usage

Add a wine with the **+** button and pick one of three ways: snap a label photo
for AI recognition, search Vivino by name, or fill in the fields yourself. The
AI route also fills maturity phases, taste profile and food pairings.

Use the quick filter in the header for type, vintage and grape. For anything
beyond that, open the advanced filter: conditions across all fields are
AND-combined, and a filter set you use often can be saved as a preset and made
the default.

### Home Assistant sensor

The REST API at `/api/summary` turns your cellar into an HA entity:

```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: "Wine Stock"
    resource: "http://localhost:5050/api/summary"
    value_template: "{{ value_json.total_bottles }}"
    unit_of_measurement: "bottles"
    json_attributes:
      - by_type
    scan_interval: 3600
```

This creates a `sensor.wine_stock` entity for dashboards and automations.

## Development

Run the app straight from the checkout:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r wine-tracker/requirements.txt
DEV_AUTH=admin:pass python3 wine-tracker/app/app.py
```

`DEV_AUTH` enables the login with a single user, so you can exercise the auth
paths without Home Assistant. Without it the app starts unauthenticated. Data
lands in `wine-tracker/app/data/`.

Every feature and every bugfix ships with tests:

```bash
cd wine-tracker && pytest tests/ -v
```

Commit messages use the prefixes Add, Fix, Update, Remove, Refactor and Polish,
in the imperative, with a first line of at most 72 characters.

## Troubleshooting

**The sidebar panel is missing for other household members.** Home Assistant
only shows add-on ingress panels to admin users, and the add-on cannot change
that. Run Wine Tracker in Docker standalone mode instead and give everyone
their own login, read-only if you like.

**Ollama is unreachable from the container.** `http://localhost:11434` points at
the Wine Tracker container itself. Use `http://host.docker.internal:11434` or
the Ollama container's name.

**Mistral returns nothing for a label photo.** Label recognition needs a vision
model. `mistral-large-latest` cannot read images, `mistral-medium-latest` and
the Pixtral models can.

**Logins are gone after a restart.** Set a fixed `SECRET_KEY`. Without it a new
key is generated on every start and all sessions are invalidated.

## Roadmap

Planned features are tracked in [ROADMAP.md](ROADMAP.md).

## License

MIT, see [LICENSE](LICENSE).

[my-ha-badge]: https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg
[my-ha-url]: https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fxenofex7%2Fha-wine-tracker

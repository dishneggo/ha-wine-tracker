# Home Assistant App: Wine Tracker

<p align="center">
  <img src="https://raw.githubusercontent.com/xenofex7/ha-wine-tracker/main/logo.png" alt="Wine Tracker logo" width="128">
</p>

![version][version-badge]

Wine Tracker manages your wine cellar from label photo to tasting note,
directly in your Home Assistant sidebar. Snap a photo and let AI fill in the
details, search Vivino for ratings and prices, and ask the AI sommelier to add,
edit or delete wines straight from the chat.

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/xenofex7/ha-wine-tracker/main/assets/261018_main_screen.png" alt="Cellar overview" width="800">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/xenofex7/ha-wine-tracker/main/assets/261018_statistics_screen.png" alt="Statistics with globe and charts" width="800">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/xenofex7/ha-wine-tracker/main/assets/261018_add_wine_screen.png" alt="Add a wine via AI, Vivino or manually" width="800">
  <img src="https://raw.githubusercontent.com/xenofex7/ha-wine-tracker/main/assets/261018_wine_edit_screen.png" alt="Edit wine details" width="800">
</p>

## Features

- **Wine cards** with photo, vintage, type, region, grape variety, rating and notes
- **AI wine label recognition** fills in all fields, including maturity phases, taste profile and food pairings (Anthropic, OpenAI, OpenRouter, Ollama, MiniMax, Mistral)
- **AI sommelier chat with full cellar CRUD** - ask about your cellar, upload label photos, and add, edit or delete wines from the conversation; sessions persist
- **Vivino wine search** - search by name, see ratings, region and price, and import directly; a regional fallback chain surfaces country-specific wines
- **Vivino ID management** - view, edit and test Vivino wine links in the edit modal
- **Reload missing data** - re-analyze wines with incomplete fields via AI or Vivino
- **Star rating** (1-5), quick `+`/`-` quantity buttons and wine duplication
- **Bottle format** from Piccolo (0.1875 l) to Nebuchadnezzar (15 l), auto-detected by AI
- **Cellar view modes** - Cards, List, Grid and a sortable Table view with responsive columns
- **Quick filter** by wine type, vintage year and grape variety
- **Advanced filter** - AND-combined conditions across every field, with text, number, choice and drink-window operators and autocomplete in the inputs
- **Filter presets** - save a filter set under a name, reuse it later, and make the advanced filter the default one
- **Activity timeline** - chronological log of wines added, consumed, restocked and removed
- **Maturity graph** - AI-generated bell curve from Youth to Maturity, Peak and Decline, with a "Today" marker
- **Taste profile and food pairings** - AI-generated body/tannin/acidity/sweetness bars and matching dishes in your language
- **Drink window** (from/until year) with AI estimation
- **Purchase price** with configurable currency
- **Autocomplete** for region, grape variety, purchase source and storage location
- **Interactive 3D globe** showing your wine regions
- **Statistics** - donut charts, stock history area chart, total bottles, total liters, value overview and average age
- **Backup and restore** - export the whole cellar as a ZIP (JSON + CSV + images) and import it back with a duplicate preview
- **6 themes** with dark and light mode
- **7 languages**: DE, EN, FR, IT, ES, PT, NL
- **REST API** at `/api/summary` for HA sensor integration
- **Fully responsive** - desktop, tablet and mobile

## Configuration

All options are set on the Home Assistant add-on configuration page.

> **AI settings saved in the app win.** Provider, API key, model and chat model
> can also be set under **Settings -> AI**, including a connection test. Those
> values are stored in the database and override both these add-on options and
> any environment variables.

### General

| Option | Default | Description |
|--------|---------|-------------|
| `currency` | `CHF` | Currency shown with prices. `CHF`, `EUR`, `USD`, `GBP`, `CAD`, `AUD`, `SEK`, `NOK`, `DKK`, `PLN`, `CZK` and `BRL` also pick the Vivino region; any other value falls back to US/USD there. |
| `language` | `de` | UI language: `de`, `en`, `fr`, `it`, `es`, `pt`, `nl` |

### AI Provider (optional)

Pick one AI provider and configure its API key and model. The AI is used for
label recognition, maturity/taste/food enrichment and the sommelier chat.

| Option | Default | Description |
|--------|---------|-------------|
| `ai_provider` | `none` | `none`, `anthropic`, `openai`, `openrouter`, `ollama`, `minimax`, `mistral` |
| `anthropic_api_key` | _(empty)_ | Claude API key from [console.anthropic.com](https://console.anthropic.com) |
| `anthropic_model` | `claude-opus-4-8` | Anthropic model identifier |
| `openai_api_key` | _(empty)_ | OpenAI API key from [platform.openai.com](https://platform.openai.com) |
| `openai_model` | `gpt-5.5` | OpenAI vision model |
| `openrouter_api_key` | _(empty)_ | OpenRouter API key from [openrouter.ai](https://openrouter.ai) |
| `openrouter_model` | `anthropic/claude-opus-4.8` | Any vision-capable OpenRouter model |
| `ollama_host` | `http://localhost:11434` | Local Ollama server URL |
| `ollama_model` | `llama3.2-vision` | Local Ollama vision model |
| `minimax_api_key` | _(empty)_ | MiniMax API key from [platform.minimaxi.com](https://platform.minimaxi.com) |
| `minimax_model` | `MiniMax-M3` | MiniMax model, vision-capable despite the name |
| `mistral_api_key` | _(empty)_ | Mistral API key from [console.mistral.ai](https://console.mistral.ai) |
| `mistral_model` | `mistral-medium-latest` | Mistral model, use a Pixtral model for label recognition |
| `chat_model` | _(empty)_ | Separate model for the sommelier chat only. Empty means the chat uses the provider model above. |

> **Tip:** Ollama runs fully local and requires no API key. Pull a vision model
> (`ollama pull llama3.2-vision`) and point `ollama_host` at your Ollama server.

### Sidebar visibility for non-admin users

Home Assistant only shows add-on ingress panels to users with admin rights.
This is enforced by Home Assistant itself and cannot be changed by the add-on.
If other household members should use Wine Tracker, run it in
[standalone Docker mode](https://github.com/xenofex7/ha-wine-tracker#docker-standalone)
with per-user logins, including view-only (readonly) accounts.

## Data Persistence

All data (SQLite database + photos) is stored under `/share/wine-tracker/` -
preserved across add-on updates, restarts and Home Assistant updates.

Back up before updating: **Settings -> Data -> Export backup** writes a ZIP
with the database, a CSV and all images, which **Settings -> Data -> Import**
reads back with a duplicate preview.

## Home Assistant Sensor (Optional)

```yaml
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

## Roadmap

Planned features are tracked in
[ROADMAP.md](https://github.com/xenofex7/ha-wine-tracker/blob/main/ROADMAP.md).

## Documentation

See the full documentation on
[GitHub](https://github.com/xenofex7/ha-wine-tracker).

[version-badge]: https://img.shields.io/badge/version-v1.11.0-blue.svg

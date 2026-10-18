# Home Assistant Add-on: Wine Tracker

![version][version-badge]
![license][license-badge]

A wine cellar tracker that runs directly in your Home Assistant sidebar.

## About

Wine Tracker manages your whole wine collection from within Home Assistant.
Snap a label photo and let AI fill in the details, search Vivino to import
wines with ratings and pricing, or type everything in yourself.

**Key features:**

- AI label recognition with six providers (Anthropic, OpenAI, OpenRouter,
  Ollama, MiniMax, Mistral)
- Vivino search with direct import and a regional fallback chain for
  country-specific labels
- AI sommelier chat with image upload, persistent history and full cellar CRUD
- Maturity graph, taste profile and food pairings, auto-filled on every AI add
- Cellar view modes: Cards, List, Grid and a sortable Table view
- Advanced filter with AND-combined conditions over every field, saved as
  reusable presets
- Activity timeline of wines added, consumed, restocked and removed
- Statistics with donut charts, stock history, total liters and value overview
- Interactive 3D globe showing your wine regions
- Backup and restore as a ZIP with JSON, CSV and images
- Six themes with dark and light mode, seven languages (DE, EN, FR, IT, ES,
  PT, NL)
- Bottle formats from Piccolo to Nebuchadnezzar, star ratings, drink windows
  and storage locations

Data is stored locally under `/share/wine-tracker/` and preserved across
updates and restarts.

[version-badge]: https://img.shields.io/badge/version-v1.11.0-blue.svg
[license-badge]: https://img.shields.io/badge/license-MIT-green.svg

# Ulixee Hero Scrape API

This is a simple web scraping service built with Express and Ulixee Hero.

## Features

- Scrapes HTML content from specified URLs.
- Blocks requests to known ad-serving domains.
- Blocks media files to reduce bandwidth usage.
- Uses random user-agent strings to avoid detection.
- Built-in detection avoidance with Hero's advanced evasion techniques.
- Designed specifically for scraping to avoid being blocked.

## Install

```bash
npm install
```

Note: The service includes `@ulixee/hero-core` for local Hero Core. Hero will automatically download the necessary browser binaries on first use.

## RUN

```bash
npm run build
npm start
```

OR

```bash
npm run dev
```

## USE

```bash
curl -X POST http://localhost:3000/scrape \
-H "Content-Type: application/json" \
-d '{
  "url": "https://example.com",
  "wait_after_load": 1000,
  "timeout": 15000,
  "headers": {
    "Custom-Header": "value"
  },
  "check_selector": "#content"
}'
```

## USING WITH FIRECRAWL

Add `PLAYWRIGHT_MICROSERVICE_URL=http://localhost:3003/scrape` to `/apps/api/.env` to configure the API to use this Hero microservice for scraping operations.

## Why Ulixee Hero?

Hero is specifically designed for web scraping and includes:

- Advanced detection avoidance techniques
- Built-in proxy support
- Automatic handling of anti-bot measures
- Reduced likelihood of being blocked compared to traditional headless browsers

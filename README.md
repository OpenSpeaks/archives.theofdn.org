# OpenSpeaks Archives

Recordings made with speakers of Indigenous and endangered languages in South Asia, published by OpenSpeaks Archives. The website is hosted by O Foundation.

## Run it

Install Node.js 20 or newer. Then run:

```
npm run validate
npm run build
npm run serve
```

Open http://127.0.0.1:8765/.

## How it's laid out

- `data/<language>/collection.json` describes a language collection.
- `data/<language>/r<n>/` is one recording session. It holds a Tome record per item (`juy002.json`) and the item's subtitles (`juy002.en.srt`).
- `scripts/` checks the records, keeps them in step with Tome and builds the site into `dist/`.
- `static/` has the stylesheet and script.

Each session gets a page at `/<language>-r<n>/`, such as `/gbm-r2/`. The build writes each item's Tome record, a Dublin Core copy and its subtitles (SRT, plus WebVTT for the player) next to the page. The `/data/` page has all records as JSON, CSV and Dublin Core.

To add or change records, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

The code is under the [Anti-Capitalist Software License v1.4](LICENSE). The content is under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) unless stated otherwise. Each item's own licence is in its Tome record.

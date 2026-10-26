# Carousel Maker – Instagram & LinkedIn Carousel Generator

Turn plain text into a designed carousel. Blank lines separate slides, the first line of each block is the title; pick a template, theme and brand footer and export PNG, ZIP or a LinkedIn PDF. Everything is rendered on a canvas in the browser: nothing is uploaded.

**Live:** https://carouselmaker-tool.vercel.app/ (placeholder – replaced after deploy)

## Features

**Free**
- Text → slides editor (blank line = new slide) plus per-slide title/body editing
- Per-slide image: upload, cover/contain, position top/bottom/background (with overlay slider)
- Automatic hook style on the first slide, generated CTA slide ("Follow for more" + handle), slide counter, swipe arrow, progress dots
- 6 templates: Bold, Minimal, Notebook, Gradient Pop, Dark Tech, Quote (each applies a suggested palette)
- Theme: background / gradient, text and accent colors, 6 system font stacks + "template default", text size and padding sliders, badge/arrow/dots toggles
- Brand footer: name, @handle, avatar (circle); 1 saved brand kit
- Formats: 4:5 (1080×1350), 1:1 (1080×1080), 9:16 Story (1080×1920), LinkedIn (1080×1350 for PDF)
- Slide strip: click to select, drag or ◀ ▶ to reorder, add / duplicate / delete, ← → keys
- Export: current slide PNG (watermark badge on free), copy to clipboard, ZIP of up to 5 slides (JSZip lazy-loaded from jsDelivr)
- State persisted in `localStorage` (`cm_state_v1`), dark/light theme

**Pro (one-time, price from `config.js`)**
- No watermark, up to 20 slides per ZIP/PDF, 2x export
- LinkedIn PDF export – multi-page PDF built in-browser with a tiny PDF writer (JPEG `/XObject` per page, no library)
- 4 premium templates: Magazine, Neon, Paper cut, Swiss grid
- Unlimited saved brand kits

## Files

```
index.html     tool page + SEO content + FAQ (JSON-LD WebApplication + FAQPage)
styles.css     _shared/base.css + app styles
app.js         editor, templates, canvas rendering, exports, PDF writer
studio.js      shared canvas/export helpers (copy of _shared/studio.js)
monetize.js    shared theme / toast / analytics / AdSense / Pro helpers
config.js      window.APP_CONFIG (site URL, AdSense, GA, checkout URL, price, license, newsletter)
privacy.html   privacy policy (required for AdSense)
terms.html     terms of use
robots.txt, sitemap.xml, vercel.json, favicon.svg, .gitignore
```

## Run locally

```
npx -y serve carousel-maker -l 5183
```

## How to monetize

1. Deploy to Vercel, then replace `carouselmaker-tool.vercel.app` in all files with the real domain (`deploy.sh` does this).
2. Create a Google AdSense account, add the site, paste the `ca-pub-…` id into `ADSENSE_CLIENT` in `config.js`. Ad slots: sidebar, below tool.
3. Create a GA4 property and set `GA_ID` to track `download`, `export_zip`, `export_pdf`, `template`, `pro_click`, `begin_checkout`.
4. Create a Lemon Squeezy product "Carousel Maker Pro" (one-time, license keys enabled). Set `PRO_CHECKOUT_URL` and the `LICENSE.store_id` / `product_id` so keys validate for real.
5. Set `NEWSLETTER.url` (Formspree / ConvertKit / Beehiiv) to show the lead-capture card.
6. Optional: add long-tail pages with `pages.json` + `node _shared/build-pages.js carousel-maker` (e.g. "linkedin carousel template", "instagram carousel size").

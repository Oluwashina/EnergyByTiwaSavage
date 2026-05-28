# Energy Release — Song Release Site (Prototype)

A single-page promo site for a song release with a **playing-card style** "make your own cover" share experience. Users upload a photo, pick a suit (♦ ♥ ♠ ♣) and a rank (A / K / Q / J / custom), and get a shareable 1080×1080 playing-card cover.

Stack: plain HTML + CSS + vanilla JS. No build step. No dependencies.

## What it does

- Hero landing with fanned sample cards, song title, artist, streaming links
- "Make Your Card" generator: photo + suit + rank → live 1080×1080 playing-card cover, rendered on `<canvas>`
- Each suit gets its own deep color fill (diamond = wine red, heart = teal, spade = ink, club = forest)
- Classic serif rank + suit mark in opposite corners, just like a real playing card
- Download as PNG · native share (Web Share API with image file on mobile) · Twitter / Facebook / WhatsApp / copy-link fallbacks

## Run locally

Just open `index.html`:

```bash
open index.html
```

Or serve it (recommended — some browsers restrict `FileReader` / clipboard on `file://`):

```bash
python3 -m http.server 8000
# then http://localhost:8000
```

## Photo tips for users

The dark suit-color fill is meant to be visible behind the subject (like the references). For the cleanest result, users should upload a photo with a **plain / removed background** (e.g. a portrait PNG with transparent or solid backdrop). If the photo has a busy background, the card still works — it just looks more like a "framed snapshot" than the reference cards.

A future improvement (see notes below) is to add automatic background removal in-browser.

## Customize for the real release

Everything you'll want to change first is in **two places**.

### 1. `script.js` — top of the file

```js
const SONG = {
  artist: "NOVA",
  title: "ENERGY RELEASE",
  tag: "OUT NOW · 05.26.26",
  shareUrl: window.location.href,
  shareText: "I made my Energy Release card. Make yours →",
};

const COVER_BG = "#f1e8cf";
const INK = "#0a1d3f";
const SUITS = {
  diamond: { label: "Diamond", color: "#7a1818" },
  heart:   { label: "Heart",   color: "#0e4a5b" },
  spade:   { label: "Spade",   color: "#1c1c2e" },
  club:    { label: "Club",    color: "#193a25" },
};
```

Tweak the colors per suit, the cream background, or the navy "ink" used for typography to match your brand.

### 2. `index.html`

- Update `<title>`, `<meta description>`, and Open Graph tags at the top.
- Replace streaming link `href`s in the hero (`Spotify`, `Apple Music`, `YouTube`).
- Tweak hero text (`title`, `subtitle`, `eyebrow`).
- Edit the `about` section copy & meta block.

### 3. Shape tweaks

The four suit shapes are paths in `script.js` (`diamondPath`, `heartPath`, `spadePath`, `clubPath`). Each takes `(ctx, centerX, centerY, radius)`. Adjust the bezier control points to taste — the diamond `k` constant (0.30) controls how "starry" the diamond's concave sides feel.

## File map

```
.
├── index.html      # markup + meta + hero sample cards (SVG)
├── styles.css      # dark site theme + chip/control styling
├── script.js       # upload, render, share — all canvas work lives here
├── assets/         # reference images
└── README.md
```

## Notes / things to improve later

- **Background removal** would make the result look identical to the reference images (subject cleanly cut out, dark suit color visible all around). Options:
  - Client-side: `@imgly/background-removal` (runs WebGPU/WASM in the browser, ~5MB but no API costs)
  - Server-side: remove.bg API, or Replicate `rembg`
- **Instagram sharing** can't send the image file directly from the open web — Meta restricts that to native apps. The standard pattern (which this prototype uses) is: tap Download → user posts manually.
- For a launch, swap the placeholder streaming buttons for a **Linkfire / Feature.fm** smart link.
- Add server-side OG image generation (`@vercel/og`) so every shared link gets a unique preview of the user's card.
- Add a small **gallery** section showing community-generated cards (would need a backend / Cloudinary / Supabase storage).

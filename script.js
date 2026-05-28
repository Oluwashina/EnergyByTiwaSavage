/* =========================================================
   NOVA — Energy Release · playing-card cover generator
   ========================================================= */

const SONG = {
  artist: "NOVA",
  title: "ENERGY RELEASE",
  tag: "OUT NOW · 05.26.26",
  shareUrl: typeof window !== "undefined" ? window.location.href : "",
  shareText: "I made my Energy Release card. Make yours →",
};

/* ---------------------------------------------------------
   Visual tokens — match the playing-card references
   --------------------------------------------------------- */

const COVER_BG = "#f1e8cf";      // cream
const INK = "#0a1d3f";           // deep navy for rank + handle text
const PHOTO_FALLBACK = "#3a1212"; // safety, never visible normally

const SUITS = {
  diamond: { label: "Diamond", color: "#7a1818" },
  heart:   { label: "Heart",   color: "#0e4a5b" },
  spade:   { label: "Spade",   color: "#1c1c2e" },
  club:    { label: "Club",    color: "#193a25" },
};

const state = {
  image: null,
  imageUrl: null,
  suit: "diamond",
  rank: "A",
  name: "",
  generatedBlob: null,
  generatedUrl: null,
  energyCover: null,
};

/* ---------------------------------------------------------
   Element lookups
   --------------------------------------------------------- */

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  suitChips: document.querySelectorAll(".suit-chip"),
  rankChips: document.querySelectorAll(".rank-chip"),
  rankInput: document.getElementById("rankInput"),
  nameInput: document.getElementById("nameInput"),
  canvas: document.getElementById("coverCanvas"),
  previewEmpty: document.getElementById("previewEmpty"),
  downloadBtn: document.getElementById("downloadBtn"),
  shareBtn: document.getElementById("shareBtn"),
  shareTwitter: document.getElementById("shareTwitter"),
  shareFacebook: document.getElementById("shareFacebook"),
  shareWhatsapp: document.getElementById("shareWhatsapp"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  toast: document.getElementById("toast"),
};

const ctx = els.canvas.getContext("2d");
const SIZE = 1080;

/* ---------------------------------------------------------
   File upload (click + drag/drop)
   --------------------------------------------------------- */

els.fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) loadImage(file);
});

["dragenter", "dragover"].forEach((evt) =>
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    els.dropzone.classList.add("is-drag");
  })
);
["dragleave", "drop"].forEach((evt) =>
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("is-drag");
  })
);
els.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) loadImage(file);
});

function loadImage(file) {
  if (file.size > 10 * 1024 * 1024) {
    toast("Image too large (max 10MB)");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageUrl = reader.result;
      els.previewEmpty.classList.add("is-hidden");
      render();
    };
    img.onerror = () => toast("Couldn't read that image. Try another.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------
   Controls
   --------------------------------------------------------- */

els.suitChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    els.suitChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.suit = chip.dataset.suit;
    if (state.image) render();
  });
});

els.rankChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    els.rankChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.rank = chip.dataset.rank;
    els.rankInput.value = chip.dataset.rank;
    if (state.image) render();
  });
});

els.rankInput.addEventListener("input", (e) => {
  const v = e.target.value.toUpperCase().slice(0, 2);
  state.rank = v || "A";
  els.rankChips.forEach((c) =>
    c.classList.toggle("is-active", c.dataset.rank === state.rank)
  );
  if (state.image) render();
});

els.nameInput.addEventListener("input", (e) => {
  state.name = e.target.value;
  if (state.image) render();
});

/* =========================================================
   Canvas rendering
   ========================================================= */

function render() {
  if (!state.image) return;
  const suit = SUITS[state.suit];

  // 1. Cream background
  ctx.fillStyle = COVER_BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 2. Filled suit shape (dark color)
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const shapeR = SIZE * 0.42;

  ctx.save();
  ctx.fillStyle = suit.color;
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.fill();
  ctx.restore();

  // 3. Photo, clipped to the shape (so the dark color is visible
  //    in the shape's extremities where the photo doesn't reach)
  ctx.save();
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.clip();

  // Photo fills a square inscribed in the shape. We bias upward
  // a bit so portraits (heads at the top) sit naturally inside.
  const photoSize = SIZE * 0.78;
  const photoX = (SIZE - photoSize) / 2;
  const photoY = (SIZE - photoSize) / 2 + SIZE * 0.02;
  drawCoverFit(state.image, photoX, photoY, photoSize, photoSize, 0.25);
  ctx.restore();

  // 4. Subtle inner shadow on the shape edge for depth
  ctx.save();
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.clip();
  const inner = ctx.createRadialGradient(cx, cy, shapeR * 0.6, cx, cy, shapeR * 1.05);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.restore();

  // 5. Corner labels (rank + suit mark), top-left and bottom-right
  drawCornerLabels(state.suit, state.rank);

  // 6. Energy cover image at bottom
  if (state.energyCover) {
    drawEnergyCover();
  }

  // 7. Tag (artist / title) and optional handle
  drawFooterLine(state.name);

  // 7. Snapshot for download / share
  els.canvas.toBlob(
    (blob) => {
      if (state.generatedUrl) URL.revokeObjectURL(state.generatedUrl);
      state.generatedBlob = blob;
      state.generatedUrl = URL.createObjectURL(blob);
      els.downloadBtn.disabled = false;
      els.shareBtn.disabled = false;
    },
    "image/png",
    0.95
  );
}

/* ---------------------------------------------------------
   Cover-fit drawImage (centered, optional vertical bias)
   verticalBias: 0 = centered, 1 = top of source kept
   --------------------------------------------------------- */

function drawCoverFit(img, dx, dy, dw, dh, verticalBias = 0) {
  const imgRatio = img.width / img.height;
  const dstRatio = dw / dh;
  let sx, sy, sw, sh;
  if (imgRatio > dstRatio) {
    sh = img.height;
    sw = sh * dstRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dstRatio;
    sx = 0;
    const excess = img.height - sh;
    sy = excess * (0.5 - verticalBias * 0.5);
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ---------------------------------------------------------
   Suit shape paths
   r is roughly the "radius" (half the bounding box).
   All paths leave the current sub-path closed.
   --------------------------------------------------------- */

function drawSuitPath(ctx, suit, cx, cy, r) {
  ctx.beginPath();
  switch (suit) {
    case "diamond": diamondPath(ctx, cx, cy, r); break;
    case "heart":   heartPath(ctx, cx, cy, r);   break;
    case "spade":   spadePath(ctx, cx, cy, r);   break;
    case "club":    clubPath(ctx, cx, cy, r);    break;
  }
  ctx.closePath();
}

// Concave 4-point star — matches the reference "diamond" silhouette.
function diamondPath(ctx, cx, cy, r) {
  const k = 0.30; // <0.5 → concave sides (star-like)
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * k, cy - r * k, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * k, cy + r * k, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * k, cy + r * k, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * k, cy - r * k, cx, cy - r);
}

// Classic heart silhouette.
function heartPath(ctx, cx, cy, r) {
  const top = cy - r * 0.25;
  const bottom = cy + r * 0.95;
  ctx.moveTo(cx, bottom);
  ctx.bezierCurveTo(
    cx - r * 1.35, cy + r * 0.15,
    cx - r * 1.0,  cy - r * 0.95,
    cx,            top
  );
  ctx.bezierCurveTo(
    cx + r * 1.0,  cy - r * 0.95,
    cx + r * 1.35, cy + r * 0.15,
    cx,            bottom
  );
}

// Spade — inverted heart with a triangular base.
function spadePath(ctx, cx, cy, r) {
  ctx.moveTo(cx, cy - r * 0.95);
  ctx.bezierCurveTo(
    cx + r * 1.0,  cy - r * 0.15,
    cx + r * 1.35, cy + r * 0.55,
    cx + r * 0.25, cy + r * 0.5
  );
  ctx.lineTo(cx + r * 0.5,  cy + r * 0.95);
  ctx.lineTo(cx - r * 0.5,  cy + r * 0.95);
  ctx.lineTo(cx - r * 0.25, cy + r * 0.5);
  ctx.bezierCurveTo(
    cx - r * 1.35, cy + r * 0.55,
    cx - r * 1.0,  cy - r * 0.15,
    cx,            cy - r * 0.95
  );
}

// Club — three lobes + stem, drawn as a single combined path.
function clubPath(ctx, cx, cy, r) {
  const lobeR = r * 0.42;
  // top lobe
  ctx.arc(cx, cy - r * 0.35, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  // left lobe
  ctx.moveTo(cx - r * 0.4 + lobeR, cy + r * 0.15);
  ctx.arc(cx - r * 0.4, cy + r * 0.15, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  // right lobe
  ctx.moveTo(cx + r * 0.4 + lobeR, cy + r * 0.15);
  ctx.arc(cx + r * 0.4, cy + r * 0.15, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  // stem
  ctx.moveTo(cx - r * 0.18, cy + r * 0.95);
  ctx.lineTo(cx + r * 0.18, cy + r * 0.95);
  ctx.lineTo(cx + r * 0.08, cy + r * 0.35);
  ctx.lineTo(cx - r * 0.08, cy + r * 0.35);
}

/* ---------------------------------------------------------
   Corner labels (rank + suit) — top-left and rotated 180°
   --------------------------------------------------------- */

function drawCornerLabels(suit, rank) {
  drawRankBlock(suit, rank);

  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-SIZE / 2, -SIZE / 2);
  drawRankBlock(suit, rank);
  ctx.restore();
}

function drawRankBlock(suit, rank) {
  const pad = 70;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Rank letter (large serif)
  const rankSize = 200;
  ctx.font = `400 ${rankSize}px "DM Serif Display", "Bodoni Moda", Georgia, serif`;
  ctx.fillText(rank, pad, pad);
  const rankWidth = ctx.measureText(rank).width;

  // Suit mark — drawn as a small filled path so it stays consistent
  // with the big suit shape regardless of the user's system font.
  const markCx = pad + rankWidth / 2;
  const markCy = pad + rankSize + 65;
  const markR = 55;
  drawSuitPath(ctx, suit, markCx, markCy, markR);
  ctx.fill();

  ctx.restore();
}

/* ---------------------------------------------------------
   Footer line (small artist / song / handle text)
   --------------------------------------------------------- */

function drawFooterLine(name) {
  // Nothing currently rendered here — the corner rank/suit do all the
  // identification work, mirroring real playing cards.
  // If a handle is provided, drop it as a small mark near bottom-center
  // so it doesn't fight the corner labels.
  if (!name || !name.trim()) return;
  const handle = name.trim().startsWith("@") ? name.trim() : `@${name.trim()}`;

  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = '500 22px "DM Serif Display", Georgia, serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.7;
  ctx.fillText(handle, SIZE / 2, SIZE - 40);
  ctx.restore();
}

/* ---------------------------------------------------------
   Draw energy cover image at bottom of card
   --------------------------------------------------------- */

function drawEnergyCover() {
  if (!state.energyCover) return;
  ctx.save();
  
  // Position the energy cover at the bottom center
  const imgWidth = 300;
  const imgHeight = 200;
  const x = (SIZE - imgWidth) / 2;
  const y = SIZE - imgHeight - 60;
  
  ctx.globalAlpha = 0.95;
  ctx.drawImage(state.energyCover, x, y, imgWidth, imgHeight);
  ctx.restore();
}

/* =========================================================
   Download + Share
   ========================================================= */

els.downloadBtn.addEventListener("click", () => {
  if (!state.generatedBlob) return;
  const a = document.createElement("a");
  a.href = state.generatedUrl;
  a.download = `energy-release-${state.rank.toLowerCase()}-${state.suit}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Downloaded — share it!");
});

els.shareBtn.addEventListener("click", async () => {
  if (!state.generatedBlob) return;
  const file = new File([state.generatedBlob], "energy-release-card.png", {
    type: "image/png",
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${SONG.artist} — ${SONG.title}`,
        text: SONG.shareText,
        url: SONG.shareUrl,
      });
      return;
    } catch (err) {
      if (err.name !== "AbortError") console.warn(err);
    }
  }

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    SONG.shareText
  )}&url=${encodeURIComponent(SONG.shareUrl)}`;
  window.open(url, "_blank", "noopener");
});

els.shareTwitter.addEventListener("click", (e) => {
  e.preventDefault();
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    SONG.shareText
  )}&url=${encodeURIComponent(SONG.shareUrl)}`;
  window.open(url, "_blank", "noopener");
});
els.shareFacebook.addEventListener("click", (e) => {
  e.preventDefault();
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    SONG.shareUrl
  )}`;
  window.open(url, "_blank", "noopener");
});
els.shareWhatsapp.addEventListener("click", (e) => {
  e.preventDefault();
  const url = `https://wa.me/?text=${encodeURIComponent(
    `${SONG.shareText} ${SONG.shareUrl}`
  )}`;
  window.open(url, "_blank", "noopener");
});
els.copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(SONG.shareUrl);
    toast("Link copied!");
  } catch {
    toast("Couldn't copy. Long-press the address bar instead.");
  }
});

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
}

/* ---------------------------------------------------------
   Re-render after fonts load so the first canvas paint
   already uses the serif display face.
   --------------------------------------------------------- */

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (state.image) render();
  });
}

/* ---------------------------------------------------------
   Load energy cover image
   --------------------------------------------------------- */

const energyCoverImg = new Image();
energyCoverImg.onload = () => {
  state.energyCover = energyCoverImg;
  if (state.image) render();
};
energyCoverImg.src = "images/energycover.PNG";

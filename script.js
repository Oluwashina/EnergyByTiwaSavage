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
  photoOffset: { x: 0, y: 0 },
  photoZoom: 1,
  isDragging: false,
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
  zoomInput: document.getElementById("zoomInput"),
  resetPositionBtn: document.getElementById("resetPositionBtn"),
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
// Portrait card aspect 1080×1520. Extra height gives rank labels
// breathing room above the suit shape on mobile.
const W = 1080;
const H = 1520;
// Layout ratios — shared between render() and drawEnergyCover().
const SHAPE_CY = H * 0.37;
const SHAPE_R  = W * 0.44;
const CARD_RADIUS = 40;

// Every suit is drawn inside the same bounding box so the energy
// logo sits at an identical position regardless of which suit is picked.
const SHAPE_TOP    = 0.92; // max extent above cy (× r)
const SHAPE_BOTTOM = 1.00; // max extent below cy (× r)
const SHAPE_HALF_W = 0.92; // max half-width (× r)

function getShapeBottom(cy, r) {
  return cy + r * SHAPE_BOTTOM;
}

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
      resetPhotoTransform();
      els.previewEmpty.classList.add("is-hidden");
      els.canvas.classList.add("has-image");
      render();
    };
    img.onerror = () => toast("Couldn't read that image. Try another.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function resetPhotoTransform() {
  state.photoOffset = { x: 0, y: 0 };
  state.photoZoom = 1;
  if (els.zoomInput) els.zoomInput.value = 100;
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

/* ---------------------------------------------------------
   Photo positioning — drag inside the canvas to reposition,
   zoom slider to scale, reset to recenter.
   --------------------------------------------------------- */

let dragStart = null;

els.canvas.addEventListener("pointerdown", (e) => {
  if (!state.image) return;
  state.isDragging = true;
  els.canvas.classList.add("is-dragging");
  els.canvas.setPointerCapture(e.pointerId);
  dragStart = { x: e.clientX, y: e.clientY };
});

els.canvas.addEventListener("pointermove", (e) => {
  if (!state.isDragging || !dragStart) return;
  const rect = els.canvas.getBoundingClientRect();
  // Convert CSS pixels of movement into canvas-space pixels so the
  // drag feels 1:1 regardless of how the canvas is scaled on screen.
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const dx = (e.clientX - dragStart.x) * scaleX;
  const dy = (e.clientY - dragStart.y) * scaleY;
  state.photoOffset.x += dx;
  state.photoOffset.y += dy;
  dragStart = { x: e.clientX, y: e.clientY };
  render();
});

function endDrag(e) {
  if (!state.isDragging) return;
  state.isDragging = false;
  els.canvas.classList.remove("is-dragging");
  try { els.canvas.releasePointerCapture(e.pointerId); } catch {}
  dragStart = null;
}
els.canvas.addEventListener("pointerup", endDrag);
els.canvas.addEventListener("pointercancel", endDrag);

els.zoomInput.addEventListener("input", (e) => {
  state.photoZoom = e.target.value / 100;
  if (state.image) render();
});

els.resetPositionBtn.addEventListener("click", () => {
  resetPhotoTransform();
  if (state.image) render();
});

/* =========================================================
   Canvas rendering
   ========================================================= */

function render() {
  if (!state.image) return;
  const suit = SUITS[state.suit];

  // Reset and clip the whole card to a rounded rectangle so the saved
  // PNG has the classic playing-card silhouette.
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, W, H, CARD_RADIUS);
  } else {
    roundedRectPath(ctx, 0, 0, W, H, CARD_RADIUS);
  }
  ctx.clip();

  // 1. Cream background
  ctx.fillStyle = COVER_BG;
  ctx.fillRect(0, 0, W, H);

  // 2. Filled suit shape (dark color)
  const cx = W / 2;
  const cy = SHAPE_CY;
  const shapeR = SHAPE_R;

  ctx.save();
  ctx.fillStyle = suit.color;
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.fill();
  ctx.restore();

  // 3. Photo, clipped to the shape. The photo is drawn into a base
  // square centered on the shape, then the user's drag offset and
  // zoom are applied so they can frame the subject exactly.
  ctx.save();
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.clip();

  const baseSize = shapeR * 2.0; // covers the shape's full bounding circle
  const size = baseSize * state.photoZoom;
  const photoCx = cx + state.photoOffset.x;
  const photoCy = cy + state.photoOffset.y;
  drawCoverFit(
    state.image,
    photoCx - size / 2,
    photoCy - size / 2,
    size,
    size,
    0.25
  );
  ctx.restore();

  // 4. Subtle inner shadow on the shape edge for depth
  ctx.save();
  drawSuitPath(ctx, state.suit, cx, cy, shapeR);
  ctx.clip();
  const inner = ctx.createRadialGradient(cx, cy, shapeR * 0.6, cx, cy, shapeR * 1.05);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 5. Corner labels (rank + suit mark), top-left and bottom-right
  drawCornerLabels(state.suit, state.rank);

  // 6. Energy cover image at bottom
  if (state.energyCover) {
    drawEnergyCover();
  }

  // 7. Tag (artist / title) and optional handle
  drawFooterLine(state.name);

  // Release the outer rounded-card clip
  ctx.restore();

  // 8. Snapshot for download / share
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

// Fallback for browsers without CanvasRenderingContext2D.roundRect().
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Concave 4-point star — scaled to the shared suit bounding box.
function diamondPath(ctx, cx, cy, r) {
  const k = 0.30;
  const topY = cy - r * SHAPE_TOP;
  const botY = cy + r * SHAPE_BOTTOM;
  const hw = r * SHAPE_HALF_W;
  ctx.moveTo(cx, topY);
  ctx.quadraticCurveTo(cx + hw * k, cy - (cy - topY) * k, cx + hw, cy);
  ctx.quadraticCurveTo(cx + hw * k, cy + (botY - cy) * k, cx, botY);
  ctx.quadraticCurveTo(cx - hw * k, cy + (botY - cy) * k, cx - hw, cy);
  ctx.quadraticCurveTo(cx - hw * k, cy - (cy - topY) * k, cx, topY);
}

// Classic ♥ love heart — full round lobes, clear V-cleft, sharp bottom point.
// Fitted to the shared suit bounding box (same footprint as other suits).
function heartPath(ctx, cx, cy, r) {
  const topY = cy - r * SHAPE_TOP;
  const botY = cy + r * SHAPE_BOTTOM;
  const hw = r * SHAPE_HALF_W;
  const H = botY - topY;

  // Cleft sits below the lobe peaks so the top reads as two distinct bumps
  const cleftY = topY + H * 0.26;

  ctx.moveTo(cx, cleftY);

  // Right lobe
  ctx.bezierCurveTo(
    cx + hw * 0.20, topY,
    cx + hw, topY + H * 0.06,
    cx + hw, topY + H * 0.40
  );

  // Right side tapering to the point
  ctx.bezierCurveTo(
    cx + hw, topY + H * 0.60,
    cx + hw * 0.36, topY + H * 0.84,
    cx, botY
  );

  // Left side
  ctx.bezierCurveTo(
    cx - hw * 0.36, topY + H * 0.84,
    cx - hw, topY + H * 0.60,
    cx - hw, topY + H * 0.40
  );

  // Left lobe
  ctx.bezierCurveTo(
    cx - hw, topY + H * 0.06,
    cx - hw * 0.20, topY,
    cx, cleftY
  );
}

// Spade — same bounding box.
function spadePath(ctx, cx, cy, r) {
  const topY = cy - r * SHAPE_TOP;
  const botY = cy + r * SHAPE_BOTTOM;
  const hw = r * SHAPE_HALF_W;
  const waistY = cy + r * 0.48;

  ctx.moveTo(cx, topY);
  ctx.bezierCurveTo(
    cx + hw, cy - r * 0.45,
    cx + hw, cy + r * 0.22,
    cx + hw * 0.28, waistY
  );
  ctx.lineTo(cx + hw * 0.52, botY);
  ctx.lineTo(cx - hw * 0.52, botY);
  ctx.lineTo(cx - hw * 0.28, waistY);
  ctx.bezierCurveTo(
    cx - hw, cy + r * 0.22,
    cx - hw, cy - r * 0.45,
    cx, topY
  );
}

// Club — same bounding box.
function clubPath(ctx, cx, cy, r) {
  const botY = cy + r * SHAPE_BOTTOM;
  const hw = r * SHAPE_HALF_W;
  const lobeR = r * 0.38;
  const lobeMidY = cy + r * 0.08;

  ctx.arc(cx, cy - r * 0.54, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.moveTo(cx - hw * 0.44 + lobeR, lobeMidY);
  ctx.arc(cx - hw * 0.44, lobeMidY, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.moveTo(cx + hw * 0.44 + lobeR, lobeMidY);
  ctx.arc(cx + hw * 0.44, lobeMidY, lobeR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.moveTo(cx - hw * 0.40, botY);
  ctx.lineTo(cx + hw * 0.40, botY);
  ctx.lineTo(cx + hw * 0.10, cy + r * 0.38);
  ctx.lineTo(cx - hw * 0.10, cy + r * 0.38);
}

/* ---------------------------------------------------------
   Corner labels (rank + suit) — top-left and rotated 180°
   --------------------------------------------------------- */

function drawCornerLabels(suit, rank) {
  drawRankBlock(suit, rank);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-W / 2, -H / 2);
  drawRankBlock(suit, rank);
  ctx.restore();
}

function drawRankBlock(suit, rank) {
  const pad = 60;
  const rankSize = 120;
  const markR = 36;
  // Cream gap between the rank letter's lowest pixel and the suit mark top
  const gapAfterLetter = 26;
  // Q / J / G have tails that sit lower — add extra clearance
  const tailExtra = /[QGJqgj]/.test(rank) ? 18 : 0;

  ctx.save();
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `700 ${rankSize}px "Playfair Display", "Libre Baskerville", Georgia, serif`;

  // Alphabetic baseline gives accurate bounding boxes for tailed letters
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(rank);
  const ascent  = metrics.actualBoundingBoxAscent  || rankSize * 0.82;
  const descent = metrics.actualBoundingBoxDescent || rankSize * 0.18;
  const baselineY = pad + ascent;

  ctx.fillText(rank, pad, baselineY);
  const rankWidth = metrics.width;

  const letterBottom = baselineY + descent;
  const markCx = pad + rankWidth / 2;
  const markCy = letterBottom + gapAfterLetter + tailExtra + markR;

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
  ctx.fillText(handle, W / 2, H - 40);
  ctx.restore();
}

/* ---------------------------------------------------------
   Draw energy cover image at bottom of card
   --------------------------------------------------------- */

function drawEnergyCover() {
  if (!state.energyCover) return;
  ctx.save();

  const shapeBottom = getShapeBottom(SHAPE_CY, SHAPE_R);
  const maxBottom = H - CARD_RADIUS - 12;
  const gap = 4;
  const availableH = maxBottom - shapeBottom - gap;

  let imgWidth = W * 0.74;
  const aspect = state.energyCover.height / state.energyCover.width;
  let imgHeight = imgWidth * aspect;

  // Scale down only if the logo would clip past the card bottom
  if (imgHeight > availableH && availableH > 0) {
    imgHeight = availableH;
    imgWidth = imgHeight / aspect;
  }

  const x = (W - imgWidth) / 2;
  const y = shapeBottom + gap;

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
  // The source PNG has a solid black background. We knock it out once
  // here by walking pixels and zeroing alpha on near-black ones, so
  // the logo composites cleanly over the cream card.
  state.energyCover = removeBlackBackground(energyCoverImg, 40);
  if (state.image) render();
};
energyCoverImg.src = "images/energycover.PNG";

function removeBlackBackground(img, threshold = 30) {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(img, 0, 0);
  const data = offCtx.getImageData(0, 0, off.width, off.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    // Brightness as the max channel — keeps saturated colors (red, yellow)
    // while killing only the actual black background.
    const m = Math.max(px[i], px[i + 1], px[i + 2]);
    if (m < threshold) {
      px[i + 3] = 0;
    } else if (m < threshold * 2) {
      // Smooth edge: fade alpha for near-black anti-aliasing pixels
      px[i + 3] = Math.round(((m - threshold) / threshold) * 255);
    }
  }
  offCtx.putImageData(data, 0, 0);
  return off;
}

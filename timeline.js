const CARD_W = 228;
const CARD_H = 236;
const SLOT = 276;
const PAD_X = 72;
const TOP = 32;
const AXIS_GAP = 78;
const ABOVE_Y = TOP;
const AXIS_Y = ABOVE_Y + CARD_H + AXIS_GAP;
const BELOW_Y = AXIS_Y + AXIS_GAP;
const WORLD_H = BELOW_Y + CARD_H + 40;

const SPECS = [
  ["designer", "Дизайнер"],
  ["generation", "Поколение"],
  ["country", "Страна"],
  ["category", "Категория"],
  ["paradigm", "Парадигма"],
  ["inputs", "Типы ввода"],
  ["buttons", "Кнопки"],
  ["feedback", "Обратная связь"],
  ["connection", "Подключение"],
  ["form", "Форм-фактор"],
  ["body", "Зона тела"],
  ["hands", "Рук требуется"],
  ["motion", "Сенсор движения"],
  ["haptic", "Тактильная отдача"],
  ["wireless", "Беспроводной"],
  ["status", "Статус"],
  ["experimental", "Экспериментальный"],
  ["price", "Цена на старте"],
  ["sales", "Продажи"],
];

const stage = document.getElementById("stage");
const scroller = document.getElementById("scroller");
const sizer = document.getElementById("sizer");
const world = document.getElementById("world");
const canvas = document.getElementById("plot");
const ctx = canvas.getContext("2d");
const dialog = document.getElementById("dialog");
const sheet = dialog.querySelector(".sheet");
const nowYear = document.getElementById("now-year");
const kicker = document.getElementById("kicker");
const zoomOut = document.getElementById("zoom-out");
const zoomIn = document.getElementById("zoom-in");
const zoomReset = document.getElementById("zoom-reset");

const items = CONTROLLERS.slice().sort((a, b) => a.year - b.year || a.id - b.id);
const byId = new Map(items.map((item) => [item.id, item]));

const state = {
  zoom: 1,
  hoverId: null,
  openId: null,
  imageIndex: 0,
  suppressClick: false,
  drag: null,
  frame: 0,
};

const layout = {
  worldW: 0,
  worldH: WORLD_H,
  axisY: AXIS_Y,
  years: [],
  decades: [],
};

document.documentElement.style.setProperty("--card-w", CARD_W + "px");
document.documentElement.style.setProperty("--card-h", CARD_H + "px");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathUrl(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isExperimental(item) {
  return String(item.experimental || "").toLowerCase() === "yes";
}

function decadeTitle(year) {
  return Math.floor(year / 10) * 10 + "-е";
}

function linkLabel(href) {
  try {
    const url = new URL(href);
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const host = url.hostname.replace(/^www\./, "");
    const short = path.length > 72 ? path.slice(0, 69) + "…" : path;
    return short ? host + " / " + short : host;
  } catch {
    return href;
  }
}

function layoutItems() {
  items.forEach((item, index) => {
    const above = index % 2 === 0;
    item.x = PAD_X + index * SLOT;
    item.y = above ? ABOVE_Y : BELOW_Y;
    item.above = above;
    item.dotX = item.x + CARD_W / 2;
    item.dotY = AXIS_Y;
    item.joinY = above ? item.y + CARD_H : item.y;
  });
  layout.worldW = PAD_X + Math.max(0, items.length - 1) * SLOT + CARD_W + PAD_X;

  const years = [];
  const decades = [];
  for (const item of items) {
    const year = years[years.length - 1];
    if (!year || year.year !== item.year) years.push({ year: item.year, decade: item.decade, first: item });
    const decade = decades[decades.length - 1];
    if (!decade || decade.decade !== item.decade) {
      decades.push({ decade: item.decade, year: item.year, x1: item.x - SLOT / 2, x2: item.x + CARD_W + SLOT / 2, alt: decades.length % 2 === 1 });
    } else {
      decade.x2 = item.x + CARD_W + SLOT / 2;
    }
  }
  layout.years = years;
  layout.decades = decades;
}

function renderCards() {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "card" + (isExperimental(item) ? " is-experimental" : "");
    card.dataset.id = String(item.id);
    card.tabIndex = 0;
    card.style.left = item.x + "px";
    card.style.top = item.y + "px";
    card.setAttribute("aria-label", item.year + " " + item.name);

    if (item.images.length) {
      const frames = document.createElement("div");
      frames.className = "frames";
      frames.dataset.n = String(Math.min(item.images.length, 4));
      item.images.slice(0, 4).forEach((src, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "shot";
        button.dataset.index = String(index);
        const img = document.createElement("img");
        img.alt = item.name;
        img.loading = "lazy";
        img.decoding = "async";
        img.src = pathUrl(src);
        button.appendChild(img);
        frames.appendChild(button);
      });
      card.appendChild(frames);
    } else {
      const frames = document.createElement("div");
      frames.className = "frames is-empty";
      const note = document.createElement("p");
      note.textContent = item.category || "Нет изображения";
      frames.appendChild(note);
      card.appendChild(frames);
    }

    const cap = document.createElement("div");
    cap.className = "cap";
    const year = document.createElement("span");
    year.className = "year";
    year.textContent = String(item.year);
    const name = document.createElement("strong");
    name.textContent = item.name;
    cap.append(year, name);
    card.appendChild(cap);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openController(item.id, 0);
      }
    });
    fragment.appendChild(card);
  }
  world.appendChild(fragment);
}

function verticalPad() {
  return Math.max(0, (scroller.clientHeight - layout.worldH * state.zoom) / 2);
}

function worldToCanvas(x, y) {
  return [x * state.zoom - scroller.scrollLeft, verticalPad() + y * state.zoom - scroller.scrollTop];
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#12110e";
  ctx.fillRect(0, 0, width, height);

  for (const span of layout.decades) {
    const [x1] = worldToCanvas(span.x1, 0);
    const [x2] = worldToCanvas(span.x2, 0);
    if (x2 < 0 || x1 > width) continue;
    if (span.alt) {
      ctx.fillStyle = "#191714";
      ctx.fillRect(x1, 0, x2 - x1, height);
    }
    const [, labelY] = worldToCanvas(0, AXIS_Y - 48);
    const labelX = clamp(x1 + 14, 14, Math.min(width - 78, x2 - 40));
    if (labelY > 8 && labelY < height - 8 && x2 > 24 && x1 < width - 8) {
      const text = decadeTitle(span.year);
      ctx.font = "500 12px Avenir Next, Segoe UI, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = span.alt ? "#191714" : "#12110e";
      ctx.fillRect(labelX - 4, labelY - 9, textWidth + 8, 18);
      ctx.fillStyle = "#b7ad9d";
      ctx.fillText(text, labelX, labelY);
    }
  }

  const [, axisY] = worldToCanvas(0, AXIS_Y);
  const [axisStart] = worldToCanvas(0, AXIS_Y);
  const [axisEnd] = worldToCanvas(layout.worldW, AXIS_Y);
  ctx.strokeStyle = "rgba(240, 230, 212, 0.9)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(Math.max(0, axisStart), axisY);
  ctx.lineTo(Math.min(width, axisEnd), axisY);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(240, 230, 212, 0.55)";
  ctx.beginPath();
  for (const item of items) {
    if (item.id === state.hoverId || item.id === state.openId) continue;
    const [x, y1] = worldToCanvas(item.dotX, item.dotY);
    const [, y2] = worldToCanvas(item.dotX, item.joinY);
    if (x < -40 || x > width + 40) continue;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();

  const hot = [state.hoverId, state.openId].filter((id) => id != null);
  if (hot.length) {
    ctx.strokeStyle = "#b8432f";
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (const id of hot) {
      const item = byId.get(id);
      if (!item) continue;
      const [x, y1] = worldToCanvas(item.dotX, item.dotY);
      const [, y2] = worldToCanvas(item.dotX, item.joinY);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }

  let lastLabel = -Infinity;
  ctx.font = "600 12px Iowan Old Style, Palatino, Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#cbbba3";
  for (const group of layout.years) {
    const [x, y] = worldToCanvas(group.first.dotX, AXIS_Y);
    if (x < -20 || x > width - 8) continue;
    if (x - lastLabel < 34) continue;
    lastLabel = x;
    ctx.fillText(String(group.year), x + 8, y - 8);
  }

  for (const item of items) {
    const [x, y] = worldToCanvas(item.dotX, item.dotY);
    if (x < -12 || x > width + 12) continue;
    const hotDot = item.id === state.hoverId || item.id === state.openId;
    ctx.beginPath();
    ctx.fillStyle = "#12110e";
    ctx.arc(x, y, hotDot ? 6.5 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = hotDot ? "#b8432f" : "#f0e6d4";
    ctx.arc(x, y, hotDot ? 4 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fitZoom() {
  const available = Math.max(240, scroller.clientHeight - 8);
  return clamp(available / layout.worldH, 0.32, 1);
}

function applyZoom(nextZoom, clientX, clientY, options = {}) {
  const prev = state.zoom || nextZoom;
  const oldPad = verticalPad();
  const zoom = clamp(nextZoom, 0.32, 1.85);
  const rect = scroller.getBoundingClientRect();
  const anchorX = (clientX ?? rect.left + rect.width / 2) - rect.left;
  const anchorY = (clientY ?? rect.top + rect.height / 2) - rect.top;
  const worldX = (scroller.scrollLeft + anchorX) / prev;
  const worldY = (scroller.scrollTop + anchorY - oldPad) / prev;
  state.zoom = zoom;
  const pad = verticalPad();
  sizer.style.marginTop = pad + "px";
  sizer.style.width = layout.worldW * zoom + "px";
  sizer.style.height = layout.worldH * zoom + "px";
  world.style.width = layout.worldW + "px";
  world.style.height = layout.worldH + "px";
  world.style.transform = "scale(" + zoom + ")";
  void sizer.offsetWidth;
  if (options.anchor !== false) {
    scroller.scrollLeft = worldX * zoom - anchorX;
    scroller.scrollTop = pad + worldY * zoom - anchorY;
  }
  zoomReset.textContent = Math.round(zoom * 100) + "%";
  draw();
  updateHud();
}

function centerVertically() {
  sizer.style.marginTop = verticalPad() + "px";
  scroller.scrollTop = 0;
}

function updateHud() {
  const mid = (scroller.scrollLeft + scroller.clientWidth / 2) / state.zoom;
  let best = items[0];
  let bestDistance = Infinity;
  for (const item of items) {
    const distance = Math.abs(item.dotX - mid);
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  if (best) nowYear.textContent = String(best.year);
}

function setHover(id) {
  if (state.hoverId === id) return;
  if (state.hoverId != null) {
    document.querySelector('.card[data-id="' + state.hoverId + '"]')?.classList.remove("is-hot");
  }
  state.hoverId = id;
  if (id != null) document.querySelector('.card[data-id="' + id + '"]')?.classList.add("is-hot");
  draw();
}

function displayValue(key, value) {
  if (!value) return value;
  if (["experimental", "wireless", "motion", "haptic"].includes(key)) {
    const lower = String(value).toLowerCase();
    if (lower === "yes") return "да";
    if (lower === "no") return "нет";
  }
  return value;
}

function specRow(label, value) {
  if (!value) return "";
  return '<div class="spec"><dt>' + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd></div>";
}

function linkList(urls) {
  if (!urls || !urls.length) return "";
  return (
    '<ul class="links">' +
    urls
      .map((href) => '<li><a href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer">' + escapeHtml(linkLabel(href)) + "</a></li>")
      .join("") +
    "</ul>"
  );
}

function renderSheet(item) {
  const index = items.findIndex((entry) => entry.id === item.id);
  const image = item.images[state.imageIndex] || null;
  const thumbs = item.images
    .map((src, imageIndex) => {
      return (
        '<button type="button" data-image="' +
        imageIndex +
        '" class="' +
        (imageIndex === state.imageIndex ? "is-on" : "") +
        '" aria-label="Изображение ' +
        (imageIndex + 1) +
        '"><img alt="" src="' +
        pathUrl(src) +
        '"></button>'
      );
    })
    .join("");

  const gallery = image
    ? '<div class="gallery"><div class="gallery-main"><img alt="' +
      escapeHtml(item.name) +
      '" src="' +
      pathUrl(image) +
      '"></div>' +
      (item.images.length > 1 ? '<div class="thumbs">' + thumbs + "</div>" : "") +
      "</div>"
    : "";

  const specs = SPECS.map(([key, label]) => specRow(label, displayValue(key, item[key]))).join("");
  const sources = item.sources.length
    ? '<p class="block-title">Источники</p>' + linkList(item.sources)
    : "";
  const imageSources = item.imageSources && item.imageSources.length
    ? "<details><summary>Источники изображений</summary>" + linkList(item.imageSources) + "</details>"
    : "";

  sheet.classList.toggle("is-text", !image);
  sheet.innerHTML =
    '<button type="button" class="close" data-close aria-label="Закрыть">×</button>' +
    gallery +
    '<div class="copy">' +
    '<p class="sheet-kicker">' +
    escapeHtml(item.year + " · " + (item.decade || "")) +
    " · " +
    (index + 1) +
    " / " +
    items.length +
    "</p>" +
    '<h2 id="sheet-title">' +
    escapeHtml(item.name) +
    "</h2>" +
    (item.platform ? '<p class="platform">' + escapeHtml(item.platform) + "</p>" : "") +
    (item.manufacturer ? '<p class="maker">' + escapeHtml(item.manufacturer) + "</p>" : "") +
    (item.innovation ? '<p class="lede">' + escapeHtml(item.innovation) + "</p>" : "") +
    '<div class="specs">' +
    specs +
    "</div>" +
    sources +
    imageSources +
    '<div class="neighbors">' +
    '<button type="button" data-dir="-1"' +
    (index <= 0 ? " disabled" : "") +
    ">← Предыдущий</button>" +
    '<button type="button" data-dir="1"' +
    (index >= items.length - 1 ? " disabled" : "") +
    ">Следующий →</button>" +
    "</div></div>";
}

function markOpenCard(id) {
  document.querySelector(".card.is-open")?.classList.remove("is-open");
  if (id != null) document.querySelector('.card[data-id="' + id + '"]')?.classList.add("is-open");
}

function openController(id, imageIndex) {
  const item = byId.get(id);
  if (!item) return;
  state.openId = id;
  state.imageIndex = clamp(imageIndex || 0, 0, Math.max(0, item.images.length - 1));
  renderSheet(item);
  dialog.hidden = false;
  markOpenCard(id);
  draw();
  sheet.querySelector(".close")?.focus();
}

function closeDialog() {
  const id = state.openId;
  dialog.hidden = true;
  state.openId = null;
  markOpenCard(null);
  draw();
  if (id != null) document.querySelector('.card[data-id="' + id + '"]')?.focus();
}

function stepController(direction) {
  const index = items.findIndex((item) => item.id === state.openId);
  const next = items[index + direction];
  if (next) openController(next.id, 0);
}

function scrollCardIntoView(id) {
  const item = byId.get(id);
  if (!item) return;
  const left = item.dotX * state.zoom - scroller.clientWidth / 2;
  const top = item.dotY * state.zoom - scroller.clientHeight / 2;
  scroller.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: "smooth" });
}

kicker.textContent = items.length + " устройств · " + items[0].year + "–" + items[items.length - 1].year;

world.addEventListener("pointerover", (event) => {
  const card = event.target.closest(".card");
  setHover(card ? Number(card.dataset.id) : null);
});

world.addEventListener("pointerout", (event) => {
  const card = event.target.closest(".card");
  if (!card) return;
  const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".card") : null;
  if (next === card) return;
  setHover(next ? Number(next.dataset.id) : null);
});

scroller.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const card = event.target.closest(".card");
  const shot = event.target.closest(".shot");
  state.drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: scroller.scrollLeft,
    top: scroller.scrollTop,
    moved: false,
    cardId: card ? Number(card.dataset.id) : null,
    imageIndex: shot ? Number(shot.dataset.index) : 0,
  };
  scroller.setPointerCapture(event.pointerId);
});

scroller.addEventListener("pointermove", (event) => {
  const drag = state.drag;
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 4) {
    drag.moved = true;
    scroller.classList.add("is-dragging");
  }
  if (!drag.moved) return;
  scroller.scrollLeft = drag.left - dx;
  scroller.scrollTop = drag.top - dy;
});

function endDrag(event) {
  const drag = state.drag;
  if (!drag || (event && drag.id !== event.pointerId)) return;
  if (drag.moved) state.suppressClick = true;
  else if (drag.cardId != null) {
    state.suppressClick = true;
    openController(drag.cardId, drag.imageIndex);
  }
  state.drag = null;
  scroller.classList.remove("is-dragging");
}

scroller.addEventListener("pointerup", endDrag);
scroller.addEventListener("pointercancel", endDrag);
scroller.addEventListener("click", (event) => {
  if (!state.suppressClick) return;
  state.suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);

scroller.addEventListener("wheel", (event) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0016);
    applyZoom(state.zoom * factor, event.clientX, event.clientY);
    return;
  }
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientWidth : 1;
  scroller.scrollLeft += event.deltaY * unit;
}, { passive: false });

scroller.addEventListener("scroll", () => {
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => {
    state.frame = 0;
    draw();
    updateHud();
  });
}, { passive: true });

zoomOut.addEventListener("click", () => applyZoom(state.zoom / 1.15));
zoomIn.addEventListener("click", () => applyZoom(state.zoom * 1.15));
zoomReset.addEventListener("click", () => {
  applyZoom(fitZoom(), null, null, { anchor: false });
  centerVertically();
  draw();
});

dialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-close]")) {
    closeDialog();
    return;
  }
  const thumb = event.target.closest("[data-image]");
  if (thumb && state.openId != null) {
    state.imageIndex = Number(thumb.dataset.image);
    renderSheet(byId.get(state.openId));
    return;
  }
  const dir = event.target.closest("[data-dir]");
  if (dir && !dir.disabled) {
    const id = state.openId;
    stepController(Number(dir.dataset.dir));
    if (state.openId != null && state.openId !== id) scrollCardIntoView(state.openId);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialog.hidden) {
    closeDialog();
    return;
  }
  if (!dialog.hidden) return;
  if (event.key === "ArrowRight") scroller.scrollLeft += scroller.clientWidth * 0.45;
  if (event.key === "ArrowLeft") scroller.scrollLeft -= scroller.clientWidth * 0.45;
  if (event.key === "Home") scroller.scrollLeft = 0;
  if (event.key === "End") scroller.scrollLeft = scroller.scrollWidth;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  updateHud();
});

layoutItems();
renderCards();
state.zoom = fitZoom();
applyZoom(state.zoom, null, null, { anchor: false });
centerVertically();
resizeCanvas();
updateHud();

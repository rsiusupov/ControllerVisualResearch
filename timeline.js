const SLOT = 348;
const PAD_X = 80;
const LABEL_W = 176;
const LABEL_H = 70;
const PHOTO_W = 136;
const PHOTO_H = 104;
const AXIS_Y = 390;
const CLUSTER_GAP = 16;

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
  worldH: 820,
  axisY: AXIS_Y,
  years: [],
  decades: [],
};

const bodies = [];
const links = [];
const bodyByElement = new Map();

document.documentElement.style.setProperty("--label-w", LABEL_W + "px");
document.documentElement.style.setProperty("--label-h", LABEL_H + "px");
document.documentElement.style.setProperty("--photo-w", PHOTO_W + "px");
document.documentElement.style.setProperty("--photo-h", PHOTO_H + "px");

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
    item.above = index % 2 === 0;
    item.slotX = PAD_X + index * SLOT;
    item.dotX = item.slotX + SLOT / 2;
    item.dotY = AXIS_Y;
  });
  layout.worldW = PAD_X + Math.max(0, items.length - 1) * SLOT + SLOT + PAD_X;

  const years = [];
  const decades = [];
  for (const item of items) {
    const year = years[years.length - 1];
    if (!year || year.year !== item.year) years.push({ year: item.year, decade: item.decade, first: item });
    const decade = decades[decades.length - 1];
    if (!decade || decade.decade !== item.decade) {
      decades.push({
        decade: item.decade,
        year: item.year,
        x1: item.slotX,
        x2: item.slotX + SLOT,
        alt: decades.length % 2 === 1,
      });
    } else {
      decade.x2 = item.slotX + SLOT;
    }
  }
  layout.years = years;
  layout.decades = decades;
}

function photoSize(aspect) {
  const ratio = clamp(aspect || 1, 0.45, 2.4);
  const swing = 0.72 + Math.random() * 0.95;
  let width = 132 * swing * Math.sqrt(ratio);
  let height = width / ratio;
  if (height > 210) {
    height = 210;
    width = height * ratio;
  }
  if (height < 74) {
    height = 74;
    width = height * ratio;
  }
  return { w: clamp(width, 90, 248), h: clamp(height, 74, 210) };
}

function placeBody(body) {
  body.element.style.transform = "translate(" + body.x + "px," + body.y + "px)";
}

function eventToWorld(event) {
  const rect = scroller.getBoundingClientRect();
  return [
    (scroller.scrollLeft + event.clientX - rect.left) / state.zoom,
    (scroller.scrollTop + event.clientY - rect.top - verticalPad()) / state.zoom,
  ];
}

function stepPhysics(dtMs) {
  const frame = Math.min(dtMs, 34) / 16.67;
  let moving = false;
  for (const body of bodies) {
    if (body.grabbed) continue;
    body.vx *= Math.pow(0.72, frame);
    body.vy *= Math.pow(0.72, frame);
    if (Math.hypot(body.vx, body.vy) < 0.12) {
      body.vx = 0;
      body.vy = 0;
      continue;
    }
    body.x += body.vx * frame;
    body.y += body.vy * frame;
    moving = true;
  }
  for (let pass = 0; pass < 2; pass += 1) {
    if (collide()) moving = true;
  }
  for (const body of bodies) {
    const minX = 8;
    const minY = 8;
    const maxX = layout.worldW - body.w - 8;
    const maxY = layout.worldH - body.h - 8;
    if (body.x < minX) {
      body.x = minX;
      body.vx = Math.abs(body.vx) * 0.2;
    } else if (body.x > maxX) {
      body.x = maxX;
      body.vx = -Math.abs(body.vx) * 0.2;
    }
    if (body.y < minY) {
      body.y = minY;
      body.vy = Math.abs(body.vy) * 0.2;
    } else if (body.y > maxY) {
      body.y = maxY;
      body.vy = -Math.abs(body.vy) * 0.2;
    }
    placeBody(body);
  }
  return moving;
}

function collide() {
  const cell = 240;
  const buckets = new Map();
  const hit = new Set();
  let changed = false;
  for (const body of bodies) {
    const x0 = Math.floor(body.x / cell);
    const y0 = Math.floor(body.y / cell);
    const x1 = Math.floor((body.x + body.w) / cell);
    const y1 = Math.floor((body.y + body.h) / cell);
    for (let ix = x0; ix <= x1; ix += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        const key = ix + ":" + iy;
        const list = buckets.get(key);
        if (list) list.push(body);
        else buckets.set(key, [body]);
      }
    }
  }
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const key = (a.uid < b.uid ? a.uid + ":" + b.uid : b.uid + ":" + a.uid);
        if (hit.has(key)) continue;
        hit.add(key);
        if (separate(a, b)) changed = true;
      }
    }
  }
  return changed;
}

function separate(a, b) {
  const aCan = !a.grabbed;
  const bCan = !b.grabbed;
  if (!aCan && !bCan) return false;
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const dx = bcx - acx;
  const dy = bcy - acy;
  const overlapX = (a.w + b.w) / 2 + 8 - Math.abs(dx);
  const overlapY = (a.h + b.h) / 2 + 8 - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return false;
  const signX = dx === 0 ? (a.uid < b.uid ? 1 : -1) : Math.sign(dx);
  const signY = dy === 0 ? (a.uid < b.uid ? 1 : -1) : Math.sign(dy);
  if (overlapX < overlapY) pushApart(a, b, aCan, bCan, "x", "vx", signX, overlapX);
  else pushApart(a, b, aCan, bCan, "y", "vy", signY, overlapY);
  return true;
}

function pushApart(a, b, aCan, bCan, axis, velocity, sign, amount) {
  if (aCan && bCan) {
    a[axis] -= sign * amount * 0.5;
    b[axis] += sign * amount * 0.5;
    const rel = b[velocity] - a[velocity];
    if (rel * sign < 0) {
      const bounce = rel * 0.25;
      a[velocity] += bounce;
      b[velocity] -= bounce;
    }
    return;
  }
  const mover = aCan ? a : b;
  mover[axis] += (aCan ? -1 : 1) * sign * amount;
  if (mover[velocity] * sign * (aCan ? 1 : -1) > 0) mover[velocity] *= -0.18;
}

let bodyUid = 1;
function addBody(element, x, y, w, h, extra) {
  const body = { element, x, y, w, h, vx: 0, vy: 0, grabbed: false, uid: bodyUid, ...extra };
  bodyUid += 1;
  bodies.push(body);
  bodyByElement.set(element, body);
  element.style.width = w + "px";
  element.style.height = h + "px";
  element.style.transform = "translate(" + x + "px," + y + "px)";
  return body;
}

function connect(a, b) {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  links.push({ a, b, rest: Math.hypot(dx, dy) || 1, id: a.itemId });
}

function renderCards() {
  const fragment = document.createDocumentFragment();
  let maxY = AXIS_Y;
  for (const item of items) {
    const dir = item.above ? -1 : 1;
    const labelX = item.dotX - LABEL_W / 2;
    const labelY = item.above ? AXIS_Y - 72 - LABEL_H : AXIS_Y + 72;
    const label = document.createElement("article");
    label.className = "node is-label" + (isExperimental(item) ? " is-experimental" : "");
    label.dataset.id = String(item.id);
    label.tabIndex = 0;
    label.setAttribute("aria-label", item.year + " " + item.name);
    const cap = document.createElement("div");
    cap.className = "cap";
    const year = document.createElement("span");
    year.className = "year";
    year.textContent = String(item.year);
    const name = document.createElement("strong");
    name.textContent = item.name;
    cap.append(year, name);
    label.appendChild(cap);
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openController(item.id, 0);
      }
    });
    fragment.appendChild(label);
    const labelBody = addBody(label, labelX, labelY, LABEL_W, LABEL_H, {
      kind: "label",
      itemId: item.id,
      imageIndex: 0,
    });
    item.labelBody = labelBody;
    maxY = Math.max(maxY, labelY + LABEL_H);

    const photos = [];
    item.images.forEach((src, index) => {
      const guess = 0.62 + Math.random() * 1.15;
      const size = photoSize(guess);
      const spreadX = (Math.random() - 0.5) * 210;
      const spreadY = 28 + Math.random() * 150;
      let x = item.dotX + spreadX - size.w / 2;
      let y = item.above ? labelY - spreadY - size.h : labelY + LABEL_H + spreadY;
      x = Math.max(12, x);
      y = Math.max(12, y);
      const photo = document.createElement("article");
      photo.className = "node is-photo";
      photo.dataset.id = String(item.id);
      photo.dataset.image = String(index);
      photo.tabIndex = 0;
      photo.setAttribute("aria-label", item.name);
      const img = document.createElement("img");
      img.alt = item.name;
      img.draggable = false;
      img.decoding = "async";
      img.src = pathUrl(src);
      photo.appendChild(img);
      photo.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openController(item.id, index);
        }
      });
      fragment.appendChild(photo);
      const body = addBody(photo, x, y, size.w, size.h, {
        kind: "photo",
        itemId: item.id,
        imageIndex: index,
      });
      img.addEventListener("load", () => {
        const aspect = img.naturalWidth / img.naturalHeight || 1;
        const next = photoSize(aspect);
        const cx = body.x + body.w / 2;
        const cy = body.y + body.h / 2;
        body.w = next.w;
        body.h = next.h;
        body.x = cx - next.w / 2;
        body.y = cy - next.h / 2;
        body.element.style.width = next.w + "px";
        body.element.style.height = next.h + "px";
        placeBody(body);
      });
      photos.push(body);
      maxY = Math.max(maxY, y + size.h);
      connect(labelBody, body);
    });
    for (let i = 0; i < photos.length; i += 1) {
      for (let j = i + 1; j < photos.length; j += 1) connect(photos[i], photos[j]);
    }
    void dir;
  }
  world.appendChild(fragment);
  layout.worldH = Math.max(maxY + 48, AXIS_Y + 280);
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

const DECADE_COLOR = {
  1950: "#d5e0fb",
  1960: "#c6e8f8",
  1970: "#d5f0e2",
  1980: "#d3ebc4",
  1990: "#f4efc2",
  2000: "#f8e3c0",
  2010: "#f6d6e4",
  2020: "#e6daf8",
};

function decadeColor(year) {
  const decade = Math.floor(year / 10) * 10;
  return DECADE_COLOR[decade] || "#f7f6f3";
}

function paintWorldGradient() {
  const [x1, y1] = worldToCanvas(0, 0);
  const [x2, y2] = worldToCanvas(layout.worldW, layout.worldH);
  const gradient = ctx.createLinearGradient(x1, y1, x2, y1);
  const stops = [[0, decadeColor(layout.decades[0] ? layout.decades[0].year : 1950)]];
  for (const span of layout.decades) {
    stops.push([clamp(span.x1 / layout.worldW, 0, 1), decadeColor(span.year)]);
  }
  stops.push([1, decadeColor(layout.decades.length ? layout.decades[layout.decades.length - 1].year : 2020)]);
  stops.sort((a, b) => a[0] - b[0]);
  let last = -1;
  for (const [offset, color] of stops) {
    const next = offset <= last ? Math.min(1, last + 0.0001) : offset;
    if (next > 1) continue;
    gradient.addColorStop(next, color);
    last = next;
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
}

function edgePoint(px, py, body) {
  const cx = body.x + body.w / 2;
  const cy = body.y + body.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (!dx && !dy) return [cx, cy];
  const scale = Math.min((body.w / 2) / Math.abs(dx), (body.h / 2) / Math.abs(dy));
  return [cx + dx * scale, cy + dy * scale];
}

function strokeSegment(x1, y1, x2, y2, width) {
  const [sx, sy] = worldToCanvas(x1, y1);
  const [ex, ey] = worldToCanvas(x2, y2);
  if ((sx < -80 && ex < -80) || (sx > width + 80 && ex > width + 80)) return;
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
}

function strokeLink(x, y, body, width) {
  const [ex, ey] = edgePoint(x, y, body);
  strokeSegment(x, y, ex, ey, width);
}

function strokeBodies(a, b, width) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const [x1, y1] = edgePoint(bx, by, a);
  const [x2, y2] = edgePoint(ax, ay, b);
  strokeSegment(x1, y1, x2, y2, width);
}

function draw() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f7f6f3";
  ctx.fillRect(0, 0, width, height);
  paintWorldGradient();

  for (const span of layout.decades) {
    const [x1] = worldToCanvas(span.x1, 0);
    const [x2] = worldToCanvas(span.x2, 0);
    if (x2 < 0 || x1 > width) continue;
    const [, labelY] = worldToCanvas(0, AXIS_Y - 48);
    const labelX = clamp(x1 + 14, 14, Math.min(width - 78, x2 - 40));
    if (labelY > 8 && labelY < height - 8 && x2 > 24 && x1 < width - 8) {
      const text = decadeTitle(span.year);
      ctx.font = '500 12px "Inter Display", sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      ctx.fillRect(labelX - 5, labelY - 9, textWidth + 10, 18);
      ctx.fillStyle = "#5f5c56";
      ctx.fillText(text, labelX, labelY);
    }
  }

  const [, axisY] = worldToCanvas(0, AXIS_Y);
  const [axisStart] = worldToCanvas(0, AXIS_Y);
  const [axisEnd] = worldToCanvas(layout.worldW, AXIS_Y);
  ctx.strokeStyle = "rgba(22, 22, 22, 0.72)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(Math.max(0, axisStart), axisY);
  ctx.lineTo(Math.min(width, axisEnd), axisY);
  ctx.stroke();

  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.strokeStyle = "rgba(22, 22, 22, 0.34)";
  for (const item of items) {
    if (item.id === state.hoverId || item.id === state.openId || !item.labelBody) continue;
    strokeLink(item.dotX, AXIS_Y, item.labelBody, width);
  }
  for (const link of links) {
    if (link.id === state.hoverId || link.id === state.openId) continue;
    strokeBodies(link.a, link.b, width);
  }
  ctx.stroke();

  if (state.hoverId != null || state.openId != null) {
    ctx.beginPath();
    ctx.strokeStyle = "#1d6b73";
    ctx.lineWidth = 1.7;
    for (const item of items) {
      if ((item.id !== state.hoverId && item.id !== state.openId) || !item.labelBody) continue;
      strokeLink(item.dotX, AXIS_Y, item.labelBody, width);
    }
    for (const link of links) {
      if (link.id !== state.hoverId && link.id !== state.openId) continue;
      strokeBodies(link.a, link.b, width);
    }
    ctx.stroke();
  }

  let lastLabel = -Infinity;
  ctx.font = '500 12px "Inter Display", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#3c3a36";
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
    ctx.fillStyle = "#f7f6f3";
    ctx.arc(x, y, hotDot ? 6.5 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = hotDot ? "#1d6b73" : "#161616";
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
    document.querySelectorAll('.node[data-id="' + state.hoverId + '"]').forEach((node) => node.classList.remove("is-hot"));
  }
  state.hoverId = id;
  if (id != null) {
    document.querySelectorAll('.node[data-id="' + id + '"]').forEach((node) => node.classList.add("is-hot"));
  }
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
  document.querySelectorAll(".node.is-open").forEach((node) => node.classList.remove("is-open"));
  if (id != null) {
    document.querySelectorAll('.node[data-id="' + id + '"]').forEach((node) => node.classList.add("is-open"));
  }
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
  if (id != null) document.querySelector('.node[data-id="' + id + '"]')?.focus();
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
  const node = event.target.closest(".node");
  setHover(node ? Number(node.dataset.id) : null);
});

world.addEventListener("pointerout", (event) => {
  const node = event.target.closest(".node");
  if (!node) return;
  const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".node") : null;
  if (next && next.dataset.id === node.dataset.id) return;
  setHover(next ? Number(next.dataset.id) : null);
});

scroller.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const node = event.target.closest(".node");
  const body = node ? bodyByElement.get(node) : null;
  const [worldX, worldY] = eventToWorld(event);
  if (body) {
    body.grabbed = true;
    body.vx = 0;
    body.vy = 0;
    body.element.classList.add("is-grabbed");
    state.drag = {
      mode: "body",
      id: event.pointerId,
      body,
      offsetX: worldX - body.x,
      offsetY: worldY - body.y,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      prevX: body.x,
      prevY: body.y,
      lastT: performance.now(),
    };
  } else {
    state.drag = {
      mode: node ? "open" : "pan",
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      moved: false,
      cardId: node ? Number(node.dataset.id) : null,
      imageIndex: node && node.dataset.image != null ? Number(node.dataset.image) : 0,
    };
  }
  scroller.setPointerCapture(event.pointerId);
});

scroller.addEventListener("pointermove", (event) => {
  const drag = state.drag;
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
  if (!drag.moved) return;
  if (drag.mode === "body") {
    const [worldX, worldY] = eventToWorld(event);
    drag.body.x = worldX - drag.offsetX;
    drag.body.y = worldY - drag.offsetY;
    const now = performance.now();
    const dt = Math.max(10, now - drag.lastT);
    drag.body.vx = ((drag.body.x - drag.prevX) / dt) * 16;
    drag.body.vy = ((drag.body.y - drag.prevY) / dt) * 16;
    drag.prevX = drag.body.x;
    drag.prevY = drag.body.y;
    drag.lastT = now;
    placeBody(drag.body);
    draw();
    return;
  }
  if (drag.mode !== "pan") return;
  scroller.classList.add("is-dragging");
  scroller.scrollLeft = drag.left - dx;
  scroller.scrollTop = drag.top - dy;
});

function endDrag(event) {
  const drag = state.drag;
  if (!drag || (event && drag.id !== event.pointerId)) return;
  if (drag.mode === "body") {
    drag.body.grabbed = false;
    drag.body.element.classList.remove("is-grabbed");
    if (!drag.moved) {
      state.suppressClick = true;
      openController(drag.body.itemId, drag.body.imageIndex);
    } else {
      const speed = Math.hypot(drag.body.vx, drag.body.vy);
      if (speed > 16) {
        drag.body.vx = (drag.body.vx / speed) * 16;
        drag.body.vy = (drag.body.vy / speed) * 16;
      }
    }
  } else if (drag.moved) {
    state.suppressClick = true;
  } else if (drag.cardId != null) {
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

let seenScrollLeft = 0;
let seenScrollTop = 0;

function kickPhotosFromScroll() {
  const dx = scroller.scrollLeft - seenScrollLeft;
  const dy = scroller.scrollTop - seenScrollTop;
  seenScrollLeft = scroller.scrollLeft;
  seenScrollTop = scroller.scrollTop;
  if ((!dx && !dy) || state.drag?.mode === "body") return;
  const kickX = (dx / state.zoom) * 0.16;
  const kickY = (dy / state.zoom) * 0.16;
  for (const body of bodies) {
    if (body.kind !== "photo" || body.grabbed) continue;
    body.x += kickX;
    body.y += kickY;
    body.vx += kickX * 0.12;
    body.vy += kickY * 0.12;
  }
}

scroller.addEventListener("scroll", () => {
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => {
    state.frame = 0;
    kickPhotosFromScroll();
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

const BLOOM_COLORS = ["#FF8BCD", "#FF9900", "#0095FF", "#FB502A", "#20DE86", "#948EFF", "#FFCD29"];

function bloomRand(min, max) {
  return Math.random() * (max - min) + min;
}

function bloomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function isBloomSpace(char) {
  return /\s/.test(char);
}

function canBloomText(text) {
  const parent = text.parentElement;
  if (!parent) return false;
  if (parent.classList.contains("bloom")) return false;
  if (parent.closest("button")) return false;
  if (!parent.closest(".copy")) return false;
  return true;
}

function caretHit(x, y) {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    return { node: pos.offsetNode, offset: pos.offset };
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    return { node: range.startContainer, offset: range.startOffset };
  }
  return null;
}

function charRect(text, index) {
  const range = document.createRange();
  range.setStart(text, index);
  range.setEnd(text, index + 1);
  return range.getBoundingClientRect();
}

function pickCharIndex(text, offset, x, y) {
  const indexes = [];
  if (offset > 0) indexes.push(offset - 1);
  if (offset < text.data.length) indexes.push(offset);
  let best = null;
  let bestDist = Infinity;
  for (const index of indexes) {
    if (!text.data[index] || isBloomSpace(text.data[index])) continue;
    const rect = charRect(text, index);
    if (!rect || (rect.width === 0 && rect.height === 0)) continue;
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1.5 && dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  }
  return best;
}

function characterNear(x, y) {
  const copy = sheet.querySelector(".copy");
  if (!copy) return null;
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return canBloomText(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let best = null;
  let bestDist = Infinity;
  let node = walker.nextNode();
  while (node) {
    const probe = document.createRange();
    probe.selectNodeContents(node);
    const rects = probe.getClientRects();
    let near = false;
    for (const rect of rects) {
      if (y >= rect.top - 2 && y <= rect.bottom + 2 && x >= rect.left - 4 && x <= rect.right + 4) {
        near = true;
        break;
      }
    }
    if (near) {
      for (let index = 0; index < node.data.length; index += 1) {
        if (isBloomSpace(node.data[index])) continue;
        const rect = charRect(node, index);
        if (!rect || (rect.width === 0 && rect.height === 0)) continue;
        const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        const dist = Math.hypot(dx, dy);
        if (dist <= 1.5 && dist < bestDist) {
          best = { node, index };
          bestDist = dist;
        }
      }
    }
    node = walker.nextNode();
  }
  return best;
}

function characterAt(x, y) {
  const hit = caretHit(x, y);
  if (hit && canBloomText(hit.node)) {
    const index = pickCharIndex(hit.node, hit.offset, x, y);
    if (index != null) return { node: hit.node, index };
  }
  return characterNear(x, y);
}

function bloomAt(textNode, index) {
  if (!canBloomText(textNode)) return;
  const glyph = textNode.data[index];
  if (!glyph || isBloomSpace(glyph)) return;

  let localIndex = index;
  if (!textNode.parentElement.classList.contains("bloom-word")) {
    let start = index;
    let end = index + 1;
    while (start > 0 && !isBloomSpace(textNode.data[start - 1])) start -= 1;
    while (end < textNode.data.length && !isBloomSpace(textNode.data[end])) end += 1;
    localIndex = index - start;
    let wordNode = textNode;
    if (start > 0) wordNode = textNode.splitText(start);
    if (wordNode.data.length > end - start) wordNode.splitText(end - start);
    const word = document.createElement("span");
    word.className = "bloom-word";
    wordNode.parentNode.insertBefore(word, wordNode);
    word.appendChild(wordNode);
    textNode = wordNode;
  }

  const letterNode = localIndex > 0 ? textNode.splitText(localIndex) : textNode;
  if (letterNode.data.length > 1) letterNode.splitText(1);
  const bloom = document.createElement("span");
  bloom.className = "bloom";
  letterNode.parentNode.insertBefore(bloom, letterNode);
  bloom.appendChild(letterNode);
  paintBloom(bloom);
}

function paintBloom(element) {
  const colorA = bloomPick(BLOOM_COLORS);
  const colorB = bloomPick(BLOOM_COLORS);
  const radius = bloomPick([0, 50]);
  const direction = bloomPick(["normal", "reverse"]);
  const spin = bloomRand(3000, 5000);
  const life = bloomRand(2000, 3000);
  const scale = bloomRand(0.75, 2);
  const nudge = element.offsetHeight || 16;
  const zOrder = Math.round(Math.random() * 10);
  const blur = zOrder < 5 ? (zOrder / 5) * 3 : 0;
  element.style.color = "transparent";
  element.style.background = "linear-gradient(" + bloomRand(0, 360).toFixed(0) + "deg, " + colorA + ", " + colorB + ")";
  element.style.borderRadius = radius + "%";
  element.style.filter = "blur(" + blur.toFixed(2) + "px)";
  element.style.animation = "bloom-spin " + spin.toFixed(0) + "ms linear infinite " + direction;
  element.style.scale = String(scale);
  element.style.top = (bloomRand(-0.5, 0.5) * nudge).toFixed(1) + "px";
  element.style.left = (bloomRand(-0.5, 0.5) * nudge).toFixed(1) + "px";
  element.style.zIndex = String(zOrder);
  element.style.mixBlendMode = "hard-light";
  window.setTimeout(() => settleBloom(element), life);
}

function settleBloom(element) {
  if (!element.isConnected) return;
  element.removeAttribute("style");
  window.setTimeout(() => unwrapBloom(element), 720);
}

function unwrapBloom(element) {
  if (!element.isConnected) return;
  const parent = element.parentNode;
  const text = element.firstChild;
  if (text) parent.insertBefore(text, element);
  element.remove();
  if (parent.classList && parent.classList.contains("bloom-word") && !parent.querySelector(".bloom")) {
    const host = parent.parentNode;
    while (parent.firstChild) host.insertBefore(parent.firstChild, parent);
    parent.remove();
    host.normalize();
    return;
  }
  parent.normalize();
}

sheet.addEventListener("pointermove", (event) => {
  if (dialog.hidden) return;
  if (event.pointerType !== "touch" && event.buttons) return;
  const copy = sheet.querySelector(".copy");
  if (!copy) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  const element = target.nodeType === 1 ? target : target.parentElement;
  if (!element || !copy.contains(element) || element.closest("button")) return;
  const found = characterAt(event.clientX, event.clientY);
  if (!found) return;
  bloomAt(found.node, found.index);
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
seenScrollLeft = scroller.scrollLeft;
seenScrollTop = scroller.scrollTop;
resizeCanvas();
updateHud();
document.fonts.load('500 12px "Inter Display"').then(() => draw());
let physicsTime = performance.now();
function physicsFrame(now) {
  const moving = stepPhysics(now - physicsTime);
  physicsTime = now;
  if (moving) draw();
  requestAnimationFrame(physicsFrame);
}
requestAnimationFrame(physicsFrame);

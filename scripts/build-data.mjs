#!/usr/bin/env node
/**
 * Build the controller catalog from controllers_all.xlsx + the previous
 * game-controller table, and attach local images by scanning public/images.
 *
 *   node scripts/build-data.mjs          regenerate JSON, report, and image moves
 *   node scripts/build-data.mjs --dry    parse and print a summary, write nothing
 *
 * Image discovery happens here, at data-build time. UI code must import
 * `data/controllers.ts` and must not read the image folders itself.
 * There is no image manifest. A missing or empty controller folder is valid
 * and yields images: []. Names follow {slug}-{yearToken}-{NN}.{ext}; the
 * extension may be any alphanumeric string.
 *
 * Slug algorithm
 * --------------
 * Lowercase. Transliterate Cyrillic (ё→e, х→kh, щ→shch, й/ы→y, ъ/ь dropped).
 * Strip diacritics. Turn "&" into "and". Collapse every other run of
 * non-alphanumerics to a single hyphen and trim hyphens.
 * A controller slug is unique within its category. The first row keeps the
 * bare slug. A collision appends the year token, then -2, -3, …
 *
 * Year token used in ids-with-suffix and in filenames: the sort year for CE
 * (including year 80), or `bce500` for 500 BCE. No extra hyphens.
 *
 * Year rules
 * ----------
 * - "1958"            exact, sort year 1958, decade "1950s"
 * - "1990-е" / "1990s"  decade precision, sort year is the decade start (1990)
 * - "1972-1977"       range, sort year is the first year, yearEnd is the last
 * - "ок. 500 до н.э." circa, sort year -500 (the stated year, not a window)
 * - "80"              exact year 80 (Colosseum hypogeum; not rewritten to 1980)
 * - empty             yearNumber null; nothing is invented
 * Decade label: floor(year/10)*10 + "s", or "{abs}s BCE" when the year is negative.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const CATEGORIES = [
  {
    sheet: "games",
    slug: "games",
    label: "Игры",
    description: "Контроллеры, с помощью которых человек действует внутри игры.",
  },
  {
    sheet: "music",
    slug: "music-sound",
    label: "Музыка и звук",
    description: "Создание, исполнение или преобразование звука.",
  },
  {
    sheet: "design",
    slug: "design-digital-art",
    label: "Проектирование и дизайн / digital art",
    description: "Создание и редактирование визуальных объектов.",
  },
  {
    sheet: "photo_film_video",
    slug: "photo-film-video",
    label: "Фото, кино и видео",
    description: "Производство и обработка аудиовизуального материала.",
  },
  {
    sheet: "performance",
    slug: "performance",
    label: "Перформанс и сценические искусства",
    description: "Управление физическим и художественным исполнением.",
  },
  {
    sheet: "interactive_art",
    slug: "interactive-art",
    label: "Интерактивное искусство и иммерсивные произведения",
    description: "Взаимодействие с произведением, а не только его создание.",
  },
];

const SLUG_ALGORITHM =
  "Lowercase ASCII kebab-case. Cyrillic is transliterated (ё→e, х→kh, щ→shch, й and ы→y, ъ and ь dropped, Ukrainian і→i, ї→yi, є→ye, ґ→g). Diacritics are stripped. '&' becomes 'and'. Every other run of non-alphanumerics collapses to one hyphen. Controller slugs are unique within a category: the first row keeps the name slug; a collision appends the year token (1958, or bce500), then a numeric suffix starting at 2.";

const YEAR_RULES = [
  "The original year cell is kept on `year`. `yearNumber` is the sort key.",
  "A plain integer (1–4 digits, including 80) is exact. Decade label is floor(year/10)*10 + 's'. Year 80 stays 80 CE because the cell is 80 and the record is the Colosseum hypogeum; it is not rewritten to 1980.",
  "A decade cell such as '1990-е' or '1990s' has yearPrecision 'decade'. yearNumber is the start of that decade (1990), so it sorts at the beginning of the decade.",
  "An explicit range '1972-1977' (hyphen, en dash, or slash) has yearPrecision 'range'. yearNumber is the first year and yearEnd is the second. Sort uses the first year.",
  "A circa BCE cell 'ок. 500 до н.э.' has yearPrecision 'circa' and yearNumber -500. The stated year is the sort key; circa does not expand into a window.",
  "Negative years use decade '{abs(decadeStart)}s BCE'. The filename year token is bce500 with no extra hyphen.",
  "An empty year stays empty: yearNumber null, decade ''. Unrecognized year text is kept raw and yearNumber stays null.",
];

const IMAGE_PATTERN =
  "public/images/{categorySlug}/{controllerSlug}/{controllerSlug}-{yearToken}-{NN}.{ext}";
const IMAGE_PUBLIC_URL =
  "/images/{categorySlug}/{controllerSlug}/{controllerSlug}-{yearToken}-{NN}.{ext}";

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "ye", ґ: "g", ў: "u",
};

const ACTION = mapOf([
  ["символическое", "symbolic"],
  ["направленное", "directional"],
  ["предметное", "instrumental"],
  ["жестовое", "gestural"],
  ["иное", "other"],
]);

const BODY = mapOf([
  ["hands", "hands"],
  ["hand", "hand"],
  ["руки", "hands"],
  ["рука", "hand"],
  ["обе руки", "hands"],
  ["head", "head"],
  ["голова", "head"],
  ["eyes", "eyes"],
  ["глаза", "eyes"],
  ["eye", "eye"],
  ["глаз", "eye"],
  ["fingers", "fingers"],
  ["пальцы", "fingers"],
  ["finger", "finger"],
  ["палец", "finger"],
  ["большой палец", "thumb"],
  ["большие пальцы", "thumbs"],
  ["full body", "full-body"],
  ["всё тело", "full-body"],
  ["все тело", "full-body"],
  ["voice", "voice"],
  ["голос", "voice"],
  ["mouth", "mouth"],
  ["рот", "mouth"],
  ["feet", "feet"],
  ["foot", "foot"],
  ["ноги", "feet"],
  ["нога", "foot"],
  ["ног", "feet"],
  ["brain", "brain"],
  ["мозг", "brain"],
  ["arms", "arms"],
  ["arm", "arm"],
  ["legs", "legs"],
  ["leg", "leg"],
  ["тело", "body"],
  ["face", "face"],
  ["лицо", "face"],
  ["shoulder", "shoulder"],
  ["плечо", "shoulder"],
  ["shoulders", "shoulders"],
  ["плечи", "shoulders"],
  ["грудь", "chest"],
  ["живот", "abdomen"],
  ["запястье", "wrist"],
  ["колено", "knee"],
  ["корпус", "torso"],
  ["торс", "torso"],
  ["ладонь", "palm"],
  ["подбородок", "chin"],
  ["предплечье", "forearm"],
  ["спина", "back"],
  ["уши", "ears"],
  ["ухо", "ear"],
  ["любые", "any"],
]);

const COUNTRY = mapOf([
  ["usa", "usa"],
  ["us", "usa"],
  ["u s a", "usa"],
  ["сша", "usa"],
  ["соединенные штаты", "usa"],
  ["japan", "japan"],
  ["япония", "japan"],
  ["uk", "uk"],
  ["u k", "uk"],
  ["united kingdom", "uk"],
  ["great britain", "uk"],
  ["великобритания", "uk"],
  ["england", "uk"],
  ["англия", "uk"],
  ["germany", "germany"],
  ["германия", "germany"],
  ["france", "france"],
  ["франция", "france"],
  ["ussr", "ussr"],
  ["ссср", "ussr"],
  ["russia", "russia"],
  ["россия", "russia"],
  ["switzerland", "switzerland"],
  ["швейцария", "switzerland"],
  ["italy", "italy"],
  ["италия", "italy"],
  ["canada", "canada"],
  ["канада", "canada"],
  ["finland", "finland"],
  ["финляндия", "finland"],
  ["south korea", "south-korea"],
  ["южная корея", "south-korea"],
  ["korea", "south-korea"],
  ["корея", "south-korea"],
  ["netherlands", "netherlands"],
  ["the netherlands", "netherlands"],
  ["нидерланды", "netherlands"],
  ["holland", "netherlands"],
  ["голландия", "netherlands"],
  ["australia", "australia"],
  ["австралия", "australia"],
  ["brazil", "brazil"],
  ["бразилия", "brazil"],
  ["sweden", "sweden"],
  ["швеция", "sweden"],
  ["spain", "spain"],
  ["испания", "spain"],
  ["china", "china"],
  ["китай", "china"],
  ["taiwan", "taiwan"],
  ["тайвань", "taiwan"],
  ["israel", "israel"],
  ["израиль", "israel"],
  ["norway", "norway"],
  ["норвегия", "norway"],
  ["austria", "austria"],
  ["австрия", "austria"],
  ["belgium", "belgium"],
  ["бельгия", "belgium"],
  ["hungary", "hungary"],
  ["венгрия", "hungary"],
  ["new zealand", "new-zealand"],
  ["новая зеландия", "new-zealand"],
  ["iceland", "iceland"],
  ["исландия", "iceland"],
  ["greece", "greece"],
  ["греция", "greece"],
  ["denmark", "denmark"],
  ["дания", "denmark"],
  ["indonesia", "indonesia"],
  ["индонезия", "indonesia"],
  ["czechia", "czechia"],
  ["czech republic", "czechia"],
  ["чехия", "czechia"],
  ["vietnam", "vietnam"],
  ["вьетнам", "vietnam"],
  ["europe", "europe"],
  ["европа", "europe"],
  ["south africa", "south-africa"],
  ["юар", "south-africa"],
  ["monaco", "monaco"],
  ["монако", "monaco"],
  ["mexico", "mexico"],
  ["мексика", "mexico"],
  ["serbia", "serbia"],
  ["сербия", "serbia"],
  ["thailand", "thailand"],
  ["таиланд", "thailand"],
  ["hong kong", "hong-kong"],
  ["гонконг", "hong-kong"],
  ["singapore", "singapore"],
  ["сингапур", "singapore"],
  ["ukraine", "ukraine"],
  ["украина", "ukraine"],
  ["czechoslovakia", "czechoslovakia"],
  ["чехословакия", "czechoslovakia"],
  ["разные", "various"],
  ["разное", "various"],
  ["международная", "international"],
  ["international", "international"],
  ["австро-венгрия", "austria-hungary"],
  ["austria-hungary", "austria-hungary"],
  ["мир", "world"],
  ["world", "world"],
]);

const INPUT = mapOf([
  ["кнопки", "buttons"],
  ["кнопка", "button"],
  ["стик", "stick"],
  ["стики", "sticks"],
  ["жест", "gesture"],
  ["жесты", "gestures"],
  ["тач", "touch"],
  ["датчик", "sensor"],
  ["датчики", "sensors"],
  ["предмет", "object"],
  ["голос", "voice"],
  ["иное", "other"],
  ["клавиши", "keys"],
  ["клавиатура", "keyboard"],
  ["фейдер", "fader"],
  ["фейдеры", "faders"],
  ["дыхание", "breath"],
  ["пэды", "pads"],
  ["пэд", "pad"],
  ["энкодер", "encoder"],
  ["энкодеры", "encoders"],
  ["перо", "stylus"],
  ["стилус", "stylus"],
  ["мышь", "mouse"],
  ["джойстик", "joystick"],
  ["джойстики", "joysticks"],
  ["трекбол", "trackball"],
  ["трекболы", "trackballs"],
  ["рычаг", "lever"],
  ["рычаги", "levers"],
  ["колесо", "wheel"],
  ["колёса", "wheels"],
  ["колеса", "wheels"],
  ["педаль", "pedal"],
  ["педали", "pedals"],
  ["тачскрин", "touchscreen"],
  ["тачскрины", "touchscreens"],
  ["слайдер", "slider"],
  ["слайдеры", "sliders"],
  ["курсор", "cursor"],
  ["тело", "body"],
  ["камера", "camera"],
  ["курок", "trigger"],
  ["маховик", "handwheel"],
  ["маховики", "handwheels"],
]);

const STOP_TOKENS = new Set([
  "the", "and", "inc", "ltd", "llc", "gmbh", "corp", "corporation", "company", "co",
]);

const LEGACY_FIELDS = [
  "id",
  "designer",
  "generation",
  "category",
  "paradigm",
  "inputs",
  "buttons",
  "feedback",
  "connection",
  "form",
  "hands",
  "motion",
  "haptic",
  "wireless",
  "status",
  "experimental",
  "price",
  "sales",
  "innovation",
  "sources",
  "imageSources",
  "images",
];

function mapOf(pairs) {
  const map = new Map();
  for (const [key, value] of pairs) map.set(lookupKey(key), value);
  return map;
}

function lookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function decodeXml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTextNodes(fragment) {
  const out = [];
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
  let match;
  while ((match = re.exec(fragment))) out.push(decodeXml(match[1] || ""));
  return out.join("");
}

function readZip(buffer) {
  let eocd = -1;
  const start = Math.max(0, buffer.length - 22 - 65536);
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("xlsx: EOCD not found");
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("xlsx: bad central directory");
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compSize = buffer.readUInt32LE(cursor + 20);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.slice(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    cursor += 46 + nameLen + extraLen + commentLen;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`xlsx: bad local header for ${name}`);
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.slice(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`xlsx: unsupported compression ${method} for ${name}`);
    entries.set(name.replace(/\\/g, "/"), data);
  }
  return entries;
}

function parseSharedStrings(buffer) {
  if (!buffer) return [];
  const xml = buffer.toString("utf8");
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = re.exec(xml))) out.push(xmlTextNodes(match[1]));
  return out;
}

function cellText(inner, type, shared) {
  if (!inner) return "";
  if (type === "inlineStr" || inner.includes("<is")) {
    const inline = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
    return xmlTextNodes(inline ? inline[1] : inner);
  }
  const value = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!value) return "";
  const raw = decodeXml(value[1]).trim();
  if (type === "s") return shared[Number(raw)] ?? "";
  return raw;
}

function parseSheetRows(xml) {
  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const rowNo = /(?:^|\s)r="(\d+)"/.exec(rowMatch[1]);
    const cells = {};
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[2]))) {
      const attrs = cellMatch[1];
      const ref = /(?:^|\s)r="([A-Z]+)\d+"/.exec(attrs);
      if (!ref) continue;
      const type = /(?:^|\s)t="([^"]*)"/.exec(attrs);
      cells[ref[1]] = { type: type ? type[1] : "", inner: cellMatch[2] || "" };
    }
    rows.push({ r: rowNo ? Number(rowNo[1]) : rows.length + 1, cells });
  }
  return rows;
}

function materialize(rows, shared) {
  if (!rows.length) return [];
  const headers = {};
  for (const [col, cell] of Object.entries(rows[0].cells)) {
    headers[col] = cellText(cell.inner, cell.type, shared).trim();
  }
  const columns = Object.keys(headers);
  const records = [];
  for (const row of rows.slice(1)) {
    const record = { __row: row.r };
    let any = false;
    for (const col of columns) {
      const cell = row.cells[col];
      const value = cell ? cellText(cell.inner, cell.type, shared).trim() : "";
      record[headers[col] || col] = value;
      if (value) any = true;
    }
    if (any) records.push(record);
  }
  return records;
}

function loadWorkbook(filePath) {
  const zip = readZip(fs.readFileSync(filePath));
  const shared = parseSharedStrings(zip.get("xl/sharedStrings.xml"));
  const workbook = zip.get("xl/workbook.xml");
  const rels = zip.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error(`xlsx: missing workbook parts in ${filePath}`);
  const relMap = new Map();
  const relRe = /<Relationship\b([^>]*?)\/>/g;
  let relMatch;
  const relXml = rels.toString("utf8");
  while ((relMatch = relRe.exec(relXml))) {
    const id = /Id="([^"]+)"/.exec(relMatch[1]);
    const target = /Target="([^"]+)"/.exec(relMatch[1]);
    if (id && target) relMap.set(id[1], decodeXml(target[1]).replace(/\\/g, "/"));
  }
  const sheets = [];
  const sheetRe = /<sheet\b([^>]*?)\/>/g;
  const workbookXml = workbook.toString("utf8");
  let sheetMatch;
  while ((sheetMatch = sheetRe.exec(workbookXml))) {
    const name = /name="([^"]+)"/.exec(sheetMatch[1]);
    const rid = /(?:r:id|id)="([^"]+)"/.exec(sheetMatch[1]);
    if (!name || !rid) continue;
    let target = relMap.get(rid[1]);
    if (!target) throw new Error(`xlsx: missing relationship ${rid[1]}`);
    if (target.startsWith("/")) target = target.slice(1);
    if (!target.startsWith("xl/")) target = `xl/${target.replace(/^\//, "")}`;
    const sheetXml = zip.get(target);
    if (!sheetXml) throw new Error(`xlsx: missing ${target}`);
    sheets.push({
      name: decodeXml(name[1]),
      rows: materialize(parseSheetRows(sheetXml.toString("utf8")), shared),
    });
  }
  return sheets;
}

function field(record, ...tests) {
  const keys = Object.keys(record);
  for (const test of tests) {
    const key = keys.find((item) => item !== "__row" && test(item));
    if (key) return record[key] ?? "";
  }
  return "";
}

function sheetRecord(row) {
  return {
    row: row.__row,
    category: field(row, (key) => key.startsWith("Категория")),
    subcategory: field(row, (key) => key.startsWith("Подкатегория")),
    name: field(row, (key) => key.startsWith("Название")),
    manufacturer: field(row, (key) => key.startsWith("Производитель") || key.startsWith("Автор")),
    year: field(row, (key) => key === "Год"),
    country: field(row, (key) => key === "Страна"),
    signal: field(row, (key) => key.startsWith("Тип сигнала")),
    input: field(row, (key) => key.startsWith("Способ ввода")),
    action: field(row, (key) => key.startsWith("Соответствие")),
    body: field(row, (key) => key.startsWith("Часть тела")),
    platform: field(row, (key) => key.startsWith("Платформа") || key.startsWith("Площадка")),
    description: field(row, (key) => key.startsWith("Краткое описание")),
    significance: field(row, (key) => key.startsWith("Значимость")),
    source: field(row, (key) => key.startsWith("Источник URL")),
    image: field(row, (key) => key.startsWith("URL страницы изображения") || key.startsWith("URL изображения")),
    provenance: field(row, (key) => key.startsWith("Происхождение")),
    review: field(row, (key) => key.startsWith("Статус проверки")),
    decade: field(row, (key) => key.startsWith("Десятилетие")),
  };
}

function slugify(value) {
  let text = String(value ?? "").trim().toLowerCase().replace(/ё/g, "е");
  let latin = "";
  for (const char of text) latin += CYRILLIC[char] ?? char;
  latin = latin.normalize("NFKD").replace(/\p{M}/gu, "");
  latin = latin
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/&/g, " and ");
  latin = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return latin;
}

function isEmptyToken(value) {
  const text = lookupKey(value);
  if (!text) return true;
  const bare = text.replace(/[.\s/]/g, "");
  return (
    text === "-" ||
    text === "—" ||
    text === "–" ||
    text === "n/a" ||
    text === "н/д" ||
    text === "н/д." ||
    text === "none" ||
    text === "нет" ||
    bare === "-" ||
    bare === "—" ||
    bare === "–" ||
    bare === "na" ||
    bare === "nd" ||
    bare === "нд"
  );
}

function splitMulti(raw) {
  const whole = String(raw ?? "").trim();
  if (!whole || isEmptyToken(whole)) return [];
  const parts = [];
  let buf = "";
  let depth = 0;
  const push = () => {
    const text = buf.trim();
    buf = "";
    if (text && !isEmptyToken(text)) parts.push(text);
  };
  for (let i = 0; i < whole.length; i += 1) {
    const char = whole[i];
    if (char === "(" || char === "[" || char === "«") {
      depth += 1;
      buf += char;
      continue;
    }
    if (char === ")" || char === "]" || char === "»") {
      depth = Math.max(0, depth - 1);
      buf += char;
      continue;
    }
    if (depth === 0 && (char === "," || char === ";" || char === "|")) {
      push();
      continue;
    }
    if (depth === 0 && (char === "/" || char === "+")) {
      const left = buf.trim();
      let j = i + 1;
      while (j < whole.length && whole[j] === " ") j += 1;
      let k = j;
      while (k < whole.length && !",;|/+".includes(whole[k]) && whole[k] !== "(") k += 1;
      const right = whole.slice(j, k).trim();
      const leftWord = left.split(/\s+/).pop() || "";
      const rightWord = right.split(/\s+/)[0] || "";
      const tiny = (word) => word.length <= 1 && /^[a-zа-яё]$/i.test(word);
      if (left && right && !tiny(leftWord) && !tiny(rightWord)) {
        push();
        i = j - 1;
        continue;
      }
    }
    buf += char;
  }
  push();
  return parts;
}

function decadeFromNumber(yearNumber) {
  if (yearNumber == null) return "";
  const start = Math.floor(yearNumber / 10) * 10;
  if (yearNumber < 0) return `${Math.abs(start)}s BCE`;
  return `${start}s`;
}

function yearToken(yearNumber) {
  if (yearNumber == null || Number.isNaN(yearNumber)) return "undated";
  if (yearNumber < 0) return `bce${Math.abs(yearNumber)}`;
  return String(yearNumber);
}

function parseYear(raw) {
  const year = String(raw ?? "").trim();
  if (!year || isEmptyToken(year)) {
    return { year, yearNumber: null, yearEnd: null, yearPrecision: null, decade: "" };
  }
  const compact = year.replace(/\s+/g, " ");
  const bce = compact.match(/^ок\.\s*(\d+)\s*до\s*н\.?\s*э\.?$/i);
  if (bce) {
    const yearNumber = -Number(bce[1]);
    return { year, yearNumber, yearEnd: null, yearPrecision: "circa", decade: decadeFromNumber(yearNumber) };
  }
  const decade = compact.match(/^(\d{3,4})(?:\s*[-–—]\s*е|s)$/i);
  if (decade) {
    const yearNumber = Number(decade[1]);
    return { year, yearNumber, yearEnd: null, yearPrecision: "decade", decade: decadeFromNumber(yearNumber) };
  }
  const range = compact.match(/^(\d{3,4})\s*[-–—/]\s*(\d{3,4})$/);
  if (range) {
    const yearNumber = Number(range[1]);
    const yearEnd = Number(range[2]);
    return { year, yearNumber, yearEnd, yearPrecision: "range", decade: decadeFromNumber(yearNumber) };
  }
  if (/^\d{1,4}(?:\.0+)?$/.test(compact)) {
    const yearNumber = Number(compact);
    return { year, yearNumber, yearEnd: null, yearPrecision: "exact", decade: decadeFromNumber(yearNumber) };
  }
  return { year, yearNumber: null, yearEnd: null, yearPrecision: null, decade: "" };
}

function signalSlug(label) {
  const key = lookupKey(label);
  if (key.startsWith("цифров") || key.startsWith("digital")) return "digital";
  if (key.startsWith("аналогов") || key.startsWith("analog")) return "analog";
  if (key.startsWith("гибрид") || key.startsWith("hybrid")) return "hybrid";
  if (key === "иное" || key === "other") return "other";
  return null;
}

function countrySlug(label) {
  const direct = COUNTRY.get(lookupKey(label));
  if (direct) return direct;
  const stripped = label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (stripped && stripped !== label) return COUNTRY.get(lookupKey(stripped)) ?? null;
  return null;
}

function tagsFrom(raw, resolve, unmapped) {
  const tags = [];
  const seen = new Set();
  for (const label of splitMulti(raw)) {
    const known = resolve(label);
    if (!known && unmapped) unmapped.add(label);
    const slug = known || slugify(label) || "item";
    const key = `${slug}\0${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({ slug, label });
  }
  return tags;
}

function splitUrls(raw) {
  const text = String(raw ?? "").trim();
  if (!text || isEmptyToken(text)) return [];
  return text
    .split(/\s*;\s*|\s*\n\s*/)
    .map((item) => item.trim())
    .filter((item) => item && !isEmptyToken(item));
}

function unionUrls(first, second) {
  const out = [];
  const seen = new Set();
  for (const url of [...first, ...second]) {
    const key = String(url ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function tokens(value) {
  return slugify(value)
    .split("-")
    .filter((token) => token.length > 2 && !STOP_TOKENS.has(token));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

function originId(provenance) {
  const match = String(provenance ?? "").match(/ID\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseDataJs(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error(`Cannot parse ${filePath}`);
  return JSON.parse(text.slice(start, end + 1));
}

function snapshotLegacy(old) {
  return {
    id: old.id,
    year: old.year,
    decade: old.decade,
    name: old.name,
    manufacturer: old.manufacturer,
    designer: old.designer ?? null,
    platform: old.platform,
    generation: old.generation,
    category: old.category,
    paradigm: old.paradigm,
    inputs: old.inputs,
    buttons: old.buttons ?? null,
    feedback: old.feedback,
    connection: old.connection,
    form: old.form,
    body: old.body,
    hands: old.hands ?? null,
    motion: old.motion,
    haptic: old.haptic,
    wireless: old.wireless,
    status: old.status,
    innovation: old.innovation,
    experimental: old.experimental,
    price: old.price ?? null,
    sales: old.sales ?? null,
    sources: old.sources ?? [],
    imageSources: old.imageSources ?? [],
    images: old.images ?? [],
  };
}

function blankController(category, source) {
  const parsed = parseYear(source.year);
  return {
    id: "",
    slug: "",
    categorySlug: category.slug,
    categoryLabel: category.label,
    categoryLabelSource: source.category || category.label,
    subcategory: null,
    _subcategoryLabel: source.subcategory || "",
    name: source.name,
    manufacturer: source.manufacturer || "",
    year: parsed.year,
    yearNumber: parsed.yearNumber,
    yearEnd: parsed.yearEnd,
    yearPrecision: parsed.yearPrecision,
    decade: parsed.decade,
    _country: source.country || "",
    _signal: source.signal || "",
    _input: source.input || "",
    _action: source.action || "",
    _body: source.body || "",
    platform: source.platform || "",
    description: source.description || "",
    significance: source.significance || "",
    sourceUrls: splitUrls(source.source),
    imageUrls: splitUrls(source.image),
    images: [],
    provenance: source.provenance || "",
    reviewStatus: source.review || "",
    recordSource: "workbook",
    sheet: category.sheet,
    sourceRow: source.row || 0,
    legacy: null,
    _nameSlug: slugify(source.name),
  };
}

function finalizeTags(records, unmapped) {
  for (const record of records) {
    record.country = tagsFrom(record._country, countrySlug, unmapped.country);
    record.signalTypes = tagsFrom(record._signal, signalSlug, unmapped.signal);
    record.inputMethods = tagsFrom(record._input, (label) => INPUT.get(lookupKey(label)) ?? null, unmapped.input);
    record.actionCorrespondences = tagsFrom(record._action, (label) => ACTION.get(lookupKey(label)) ?? null, unmapped.action);
    record.bodyParts = tagsFrom(record._body, (label) => BODY.get(lookupKey(label)) ?? null, unmapped.body);
    record.raw = {
      country: record._country,
      signal: record._signal,
      input: record._input,
      action: record._action,
      body: record._body,
      decade: record._sheetDecade || "",
    };
    delete record._country;
    delete record._signal;
    delete record._input;
    delete record._action;
    delete record._body;
    delete record._sheetDecade;
    delete record._nameSlug;
  }
  const owners = new Map();
  const subcategoryCollisions = [];
  for (const record of records) {
    const label = record._subcategoryLabel;
    delete record._subcategoryLabel;
    if (!label || isEmptyToken(label)) {
      record.subcategory = null;
      continue;
    }
    const base = slugify(label) || "subcategory";
    let slug = base;
    let n = 2;
    while (owners.has(`${record.categorySlug}\0${slug}`) && owners.get(`${record.categorySlug}\0${slug}`) !== label) {
      slug = `${base}-${n}`;
      n += 1;
    }
    if (slug !== base) {
      subcategoryCollisions.push({ categorySlug: record.categorySlug, label, slug });
    }
    owners.set(`${record.categorySlug}\0${slug}`, label);
    record.subcategory = { slug, label };
  }
  return subcategoryCollisions;
}

function assignControllerSlugs(records) {
  const used = new Map();
  const collisions = [];
  for (const record of records) {
    const set = used.get(record.categorySlug) ?? new Set();
    used.set(record.categorySlug, set);
    const base = slugify(record.name) || "controller";
    let slug = base;
    if (set.has(slug)) {
      const withYear = `${base}-${yearToken(record.yearNumber)}`;
      slug = withYear;
      let n = 2;
      while (set.has(slug)) {
        slug = `${withYear}-${n}`;
        n += 1;
      }
      collisions.push({
        categorySlug: record.categorySlug,
        name: record.name,
        year: record.year,
        base,
        slug,
      });
    }
    set.add(slug);
    record.slug = slug;
    record.id = `${record.categorySlug}/${slug}`;
  }
  return collisions;
}

function manufacturerScore(old, record) {
  const oldTokens = tokens([old.manufacturer, old.designer].filter(Boolean).join(" "));
  if (!oldTokens.length) return null;
  const next = new Set(tokens(record.manufacturer));
  let hits = 0;
  for (const token of oldTokens) if (next.has(token)) hits += 1;
  return hits / oldTokens.length;
}

function chooseCandidate(old, candidates) {
  const ranked = candidates.map((record) => ({
    record,
    score: manufacturerScore(old, record) ?? -1,
    games: record.categorySlug === "games" ? 1 : 0,
    origin: originId(record.provenance) === old.id ? 1 : 0,
  }));
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.games - a.games ||
      b.origin - a.origin ||
      a.record.sourceRow - b.record.sourceRow,
  );
  const top = ranked[0];
  const tied = ranked.filter(
    (item) =>
      item.score === top.score &&
      item.games === top.games &&
      item.origin === top.origin &&
      item.record.sourceRow === top.record.sourceRow,
  );
  return { chosen: top.record, score: top.score < 0 ? null : top.score, tie: tied.length > 1 };
}

function matchOldRecords(records, oldRecords) {
  const index = new Map();
  for (const record of records) {
    const key = `${slugify(record.name)}|${record.yearNumber ?? `raw:${record.year}`}`;
    const list = index.get(key) ?? [];
    list.push(record);
    index.set(key, list);
  }
  const matched = [];
  const unmatched = [];
  const conflicts = [];
  for (const old of oldRecords) {
    const key = `${slugify(old.name)}|${old.year}`;
    let candidates = index.get(key) ?? [];
    let method = "normalized-name+year";
    if (!candidates.length) {
      const target = slugify(old.name);
      const limit = target.length >= 12 ? 3 : 2;
      let bestDistance = Infinity;
      const fuzzy = [];
      for (const record of records) {
        if (record.yearNumber !== old.year) continue;
        const distance = levenshtein(target, slugify(record.name));
        if (distance > limit || distance === 0) continue;
        if (distance < bestDistance) {
          bestDistance = distance;
          fuzzy.length = 0;
          fuzzy.push(record);
        } else if (distance === bestDistance) fuzzy.push(record);
      }
      candidates = fuzzy;
      method = fuzzy.length ? `fuzzy-name+year(distance ${bestDistance})` : method;
    }
    if (!candidates.length) {
      unmatched.push(old);
      continue;
    }
    const choice = chooseCandidate(old, candidates);
    if (candidates.length > 1) method += "+manufacturer";
    if (choice.tie) {
      conflicts.push({
        type: "ambiguous-old-match",
        legacyId: old.id,
        name: old.name,
        year: old.year,
        candidates: candidates.map((record) => record.name),
      });
    }
    if (choice.chosen.legacy) {
      conflicts.push({
        type: "old-row-collided-with-earlier-match",
        legacyId: old.id,
        name: old.name,
        year: old.year,
        keptOn: choice.chosen.legacy.id,
      });
      unmatched.push(old);
      continue;
    }
    const pointed = originId(choice.chosen.provenance);
    if (pointed != null && pointed !== old.id) {
      conflicts.push({
        type: "origin-id-disagrees-with-name-match",
        legacyId: old.id,
        originId: pointed,
        name: old.name,
        matchedName: choice.chosen.name,
      });
    }
    choice.chosen.legacy = snapshotLegacy(old);
    choice.chosen.sourceUrls = unionUrls(choice.chosen.sourceUrls, old.sources ?? []);
    choice.chosen.imageUrls = unionUrls(choice.chosen.imageUrls, old.imageSources ?? []);
    matched.push({
      legacyId: old.id,
      name: old.name,
      year: old.year,
      manufacturer: old.manufacturer,
      controllerId: null,
      method,
      manufacturerScore: choice.score,
      categorySlug: choice.chosen.categorySlug,
      _record: choice.chosen,
    });
  }
  return { matched, unmatched, conflicts };
}

function recordFromLegacy(old, category) {
  const maker = [old.manufacturer, old.designer].filter(Boolean).join("; ");
  const source = {
    row: 0,
    category: category.label,
    subcategory: old.category ? `Базовый датасет: ${old.category}` : "",
    name: old.name,
    manufacturer: maker,
    year: String(old.year),
    country: old.country || "",
    signal: "",
    input: "",
    action: "",
    body: old.body || "",
    platform: old.platform || "",
    description: old.form || "",
    significance: old.innovation || "",
    source: (old.sources ?? []).join(" ; "),
    image: (old.imageSources ?? []).join(" ; "),
    provenance: "добавлено из старого датасета: строка не сопоставилась с новой таблицей",
    review: "",
  };
  const record = blankController(category, source);
  record.recordSource = "legacy";
  record.sheet = "legacy";
  record.legacy = snapshotLegacy(old);
  return record;
}

function extentOf(records) {
  const numbers = records.map((record) => record.yearNumber).filter((value) => value != null);
  if (!numbers.length) return { min: null, max: null };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function uniqueTags(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const key = `${tag.slug}\0${tag.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug) || a.label.localeCompare(b.label, "ru"));
  return out;
}

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function controllerImagePattern(slug, token) {
  return new RegExp(`^${escapeReg(slug)}-${escapeReg(token)}-(\\d{2,})\\.([A-Za-z0-9]+)$`, "i");
}

function discoverControllerImages(record) {
  const dir = path.join(ROOT, "public/images", record.categorySlug, record.slug);
  // Missing and empty folders are the same result: this controller has no local images yet.
  if (!fs.existsSync(dir)) return { urls: [], ignored: [], over: [] };
  const token = yearToken(record.yearNumber);
  const pattern = controllerImagePattern(record.slug, token);
  const matched = [];
  const ignored = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const found = name.match(pattern);
    if (!found) {
      ignored.push(`${record.categorySlug}/${record.slug}/${name}`);
      continue;
    }
    matched.push({ name, nn: Number(found[1]) });
  }
  matched.sort((a, b) => a.nn - b.nn || a.name.localeCompare(b.name));
  return {
    urls: matched.map((item) => `/images/${record.categorySlug}/${record.slug}/${item.name}`),
    ignored,
    over: matched.length > 10 ? matched.slice(10).map((item) => item.name) : [],
  };
}

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, out);
    else if (name !== ".DS_Store" && !name.startsWith(".")) out.push(full);
  }
}

function stagedRenameCount() {
  const git = spawnSync("git", ["diff", "--cached", "--name-status", "-M"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (git.status !== 0) return null;
  return git.stdout.split("\n").filter((line) => line.startsWith("R")).length;
}

function relativeToRoot(full) {
  return path.relative(ROOT, full).split(path.sep).join("/");
}

function planImageMoves(records) {
  const plans = [];
  const claimed = new Set();
  for (const record of records) {
    if (!record.legacy) continue;
    const listed = record.legacy.images ?? [];
    const folders = new Set(listed.map((item) => path.posix.dirname(item)));
    const listedSet = new Set(listed);
    const extras = [];
    for (const folder of folders) {
      const fullFolder = path.join(ROOT, folder);
      if (!fs.existsSync(fullFolder)) continue;
      for (const name of fs.readdirSync(fullFolder)) {
        if (name === ".DS_Store" || name.startsWith(".")) continue;
        const rel = path.posix.join(folder, name);
        const full = path.join(ROOT, rel);
        if (!listedSet.has(rel) && fs.existsSync(full) && fs.statSync(full).isFile()) extras.push(rel);
      }
    }
    extras.sort();
    const token = yearToken(record.yearNumber);
    // Index from the full original list so a rerun does not renumber files
    // that were already moved.
    [...listed, ...extras].forEach((src, index) => {
      const ext = (path.posix.extname(src).slice(1) || "bin").toLowerCase();
      const nn = String(index + 1).padStart(2, "0");
      const file = `${record.slug}-${token}-${nn}.${ext}`;
      const dest = path.posix.join("public/images", record.categorySlug, record.slug, file);
      const srcExists = fs.existsSync(path.join(ROOT, src));
      const destExists = fs.existsSync(path.join(ROOT, dest));
      if (!srcExists && !destExists) {
        if (!listedSet.has(src)) return;
        plans.push({
          src,
          dest,
          listed: true,
          absent: true,
          controllerId: record.id,
          legacyId: record.legacy.id,
          name: record.name,
          year: record.year,
        });
        return;
      }
      if (srcExists) claimed.add(src);
      plans.push({
        src,
        dest,
        listed: listedSet.has(src),
        absent: false,
        controllerId: record.id,
        legacyId: record.legacy.id,
        name: record.name,
        year: record.year,
      });
    });
  }
  return { plans, claimed };
}

function collectUnmatched(claimed) {
  const files = [];
  walkFiles(path.join(ROOT, "images"), files);
  return files
    .map(relativeToRoot)
    .filter((rel) => rel.startsWith("images/") && !claimed.has(rel))
    .sort();
}

function moveFile(src, dest) {
  const absSrc = path.join(ROOT, src);
  const absDest = path.join(ROOT, dest);
  fs.mkdirSync(path.dirname(absDest), { recursive: true });
  if (!fs.existsSync(absSrc)) {
    if (fs.existsSync(absDest)) return { status: "already", bytes: fs.statSync(absDest).size };
    return { status: "missing", bytes: 0 };
  }
  const size = fs.statSync(absSrc).size;
  if (fs.existsSync(absDest)) {
    const destSize = fs.statSync(absDest).size;
    if (destSize !== size) {
      throw new Error(`Refusing to drop ${src}: destination exists with a different size (${destSize} != ${size})`);
    }
    return { status: "dest-exists", bytes: size };
  }
  const git = spawnSync("git", ["mv", "--", src, dest], { cwd: ROOT, encoding: "utf8" });
  if (git.status !== 0) {
    fs.copyFileSync(absSrc, absDest);
    if (!fs.existsSync(absDest) || fs.statSync(absDest).size !== size) {
      if (fs.existsSync(absDest)) fs.unlinkSync(absDest);
      throw new Error(`Could not move ${src} -> ${dest}\n${git.stderr || git.stdout}`);
    }
    fs.unlinkSync(absSrc);
    return { status: "copied", bytes: size };
  }
  if (!fs.existsSync(absDest) || fs.existsSync(absSrc) || fs.statSync(absDest).size !== size) {
    throw new Error(`git mv did not preserve ${src} -> ${dest} (${size} bytes)`);
  }
  return { status: "moved", bytes: size };
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) removeEmptyDirs(full);
  }
  if (dir !== path.join(ROOT, "images") && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function rewriteDataJs(plans) {
  const filePath = path.join(ROOT, "data.js");
  let text = fs.readFileSync(filePath, "utf8");
  const replacements = plans
    .filter((plan) => plan.listed)
    .slice()
    .sort((a, b) => b.src.length - a.src.length);
  let replaced = 0;
  for (const plan of replacements) {
    const from = JSON.stringify(plan.src);
    const to = JSON.stringify(plan.dest);
    const count = text.split(from).length - 1;
    if (count === 0) {
      const already = text.split(to).length - 1;
      if (already >= 1) continue;
      // Already removed from data.js along with the file.
      if (plan.absent) continue;
      throw new Error(`Expected one data.js path for ${plan.src}, found 0`);
    }
    if (count !== 1) throw new Error(`Expected one data.js path for ${plan.src}, found ${count}`);
    text = text.split(from).join(to);
    replaced += 1;
  }
  const prunedImages = pruneMissingDataJsImages(text);
  text = prunedImages.text;
  fs.writeFileSync(filePath, text);
  const parsed = parseDataJs(filePath);
  const missing = [];
  for (const record of parsed) {
    for (const image of record.images ?? []) {
      if (!fs.existsSync(path.join(ROOT, image))) missing.push(image);
    }
  }
  if (missing.length) {
    throw new Error(`data.js image paths missing on disk:\n${missing.slice(0, 8).join("\n")}`);
  }
  return { replaced, pruned: prunedImages.pruned, controllers: parsed.length };
}

function pruneMissingDataJsImages(text) {
  let pruned = 0;
  const next = text.replace(/"images": \[([\s\S]*?)\]/g, (full, body) => {
    const paths = [...body.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) => JSON.parse(`"${match[1]}"`));
    const kept = paths.filter((item) => fs.existsSync(path.join(ROOT, item)));
    if (kept.length === paths.length) return full;
    pruned += paths.length - kept.length;
    if (!kept.length) return '"images": []';
    const inner = kept.map((item) => `      ${JSON.stringify(item)}`).join(",\n");
    return `"images": [\n${inner}\n    ]`;
  });
  return { text: next, pruned };
}

function compareGameWorkbook(oldRecords) {
  const filePath = path.join(ROOT, "game_controllers.xlsx");
  if (!fs.existsSync(filePath)) return [{ issue: "game_controllers.xlsx missing" }];
  const sheets = loadWorkbook(filePath);
  const sheet = sheets.find((item) => item.name === "Controllers");
  if (!sheet) return [{ issue: "Controllers sheet missing", sheets: sheets.map((item) => item.name) }];
  const rows = sheet.rows.map((row) => ({
    id: Number(field(row, (key) => key.startsWith("ID") || key === "A")),
    year: field(row, (key) => key.startsWith("Год")),
    name: field(row, (key) => key.startsWith("Контроллер")),
    manufacturer: field(row, (key) => key.startsWith("Производитель")),
  }));
  const byId = new Map(oldRecords.map((record) => [record.id, record]));
  const diffs = [];
  const seen = new Set();
  for (const row of rows) {
    seen.add(row.id);
    const old = byId.get(row.id);
    if (!old) {
      diffs.push({ id: row.id, issue: "xlsx row missing from data.js", name: row.name, year: row.year });
      continue;
    }
    if (String(old.year) !== String(Number(row.year)) || old.name !== row.name) {
      diffs.push({
        id: row.id,
        issue: "name or year differs",
        dataJs: { name: old.name, year: old.year },
        xlsx: { name: row.name, year: row.year },
      });
    }
  }
  for (const old of oldRecords) {
    if (!seen.has(old.id)) diffs.push({ id: old.id, issue: "data.js row missing from game_controllers.xlsx", name: old.name });
  }
  return { rowCount: rows.length, diffs };
}

function combinedSheetCheck(workbook) {
  const combined = workbook.find((sheet) => sheet.name === "Все");
  if (!combined) return { present: false, mismatches: 0 };
  const categoryRows = [];
  for (const category of CATEGORIES) {
    const sheet = workbook.find((item) => item.name === category.sheet);
    if (!sheet) throw new Error(`Missing sheet ${category.sheet}`);
    categoryRows.push(...sheet.rows);
  }
  let mismatches = 0;
  const examples = [];
  const limit = Math.min(categoryRows.length, combined.rows.length);
  for (let i = 0; i < limit; i += 1) {
    const left = new Set(Object.entries(categoryRows[i]).filter(([key, value]) => key !== "__row" && String(value).trim()).map(([, value]) => String(value).trim()));
    const right = new Set(Object.values(combined.rows[i]).filter((value) => String(value).trim()).map((value) => String(value).trim()));
    for (const value of left) {
      if (!right.has(value)) {
        mismatches += 1;
        if (examples.length < 5) examples.push({ index: i, value });
        break;
      }
    }
  }
  return {
    present: true,
    categoryRows: categoryRows.length,
    combinedRows: combined.rows.length,
    mismatches,
    examples,
    usedAsSource: false,
  };
}

function publicUrlToExt(url) {
  const ext = path.posix.extname(url).slice(1).toLowerCase();
  return ext || "(none)";
}

function selfCheck() {
  assert.equal(slugify("Терменвокс"), "termenvoks");
  assert.equal(slugify("Jörg Mager"), "jorg-mager");
  assert.equal(slugify("Sphärophon"), "spharophon");
  assert.equal(slugify("Spacewar! control boxes"), "spacewar-control-boxes");
  assert.equal(slugify("всё тело"), "vse-telo");
  assert.equal(slugify("Game & Watch"), "game-and-watch");
  const exact = parseYear("1958");
  assert.equal(exact.yearNumber, 1958);
  assert.equal(exact.yearPrecision, "exact");
  assert.equal(exact.decade, "1950s");
  const decade = parseYear("1990-е");
  assert.equal(decade.yearNumber, 1990);
  assert.equal(decade.yearPrecision, "decade");
  assert.equal(decade.decade, "1990s");
  const range = parseYear("1972-1977");
  assert.equal(range.yearNumber, 1972);
  assert.equal(range.yearEnd, 1977);
  assert.equal(range.yearPrecision, "range");
  const bce = parseYear("ок. 500 до н.э.");
  assert.equal(bce.yearNumber, -500);
  assert.equal(bce.yearPrecision, "circa");
  assert.equal(bce.decade, "500s BCE");
  assert.equal(yearToken(-500), "bce500");
  const early = parseYear("80");
  assert.equal(early.yearNumber, 80);
  assert.equal(early.yearPrecision, "exact");
  assert.equal(early.decade, "80s");
  assert.deepEqual(splitMulti("руки, ноги"), ["руки", "ноги"]);
  assert.deepEqual(splitMulti("hands + feet"), ["hands", "feet"]);
  assert.deepEqual(splitMulti("клавиши/фейдер"), ["клавиши", "фейдер"]);
  assert.deepEqual(splitMulti("аналоговый сигнал X/Y"), ["аналоговый сигнал X/Y"]);
  assert.deepEqual(splitMulti("—"), []);
  assert.deepEqual(splitMulti("н/д"), []);
  assert.deepEqual(splitMulti("символическое / направленное"), ["символическое", "направленное"]);
  assert.deepEqual(splitMulti("USA / Israel (PrimeSense)"), ["USA", "Israel (PrimeSense)"]);
  assert.equal(signalSlug("цифровой (радио)"), "digital");
  assert.equal(countrySlug("Israel (PrimeSense)"), "israel");
  assert.equal(ACTION.get(lookupKey("предметное")), "instrumental");
  const imagePattern = controllerImagePattern("dualsense", "2020");
  for (const ext of ["webp", "jpg", "jpeg", "png", "gif", "avif", "WEBP"]) {
    assert.equal(imagePattern.test(`dualsense-2020-01.${ext}`), true, ext);
    assert.equal(imagePattern.test(`dualsense-2020-12.${ext}`), true, ext);
  }
  assert.equal(imagePattern.test("dualsense-2020-1.jpg"), false);
  assert.equal(imagePattern.test("other-2020-01.webp"), false);
  const emptyImages = discoverControllerImages({
    categorySlug: "games",
    slug: "no-such-controller-photo-set",
    yearNumber: 1958,
  });
  assert.deepEqual(emptyImages, { urls: [], ignored: [], over: [] });
}

function buildCatalog(records) {
  const categories = CATEGORIES.map((category) => {
    const rows = records.filter((record) => record.categorySlug === category.slug);
    return {
      slug: category.slug,
      label: category.label,
      description: category.description,
      sheet: category.sheet,
      count: rows.length,
      yearExtent: extentOf(rows),
    };
  });
  const byCategory = {};
  for (const category of categories) byCategory[category.slug] = category.yearExtent;
  const subcategoryTags = [];
  const seenSub = new Set();
  for (const record of records) {
    if (!record.subcategory) continue;
    const key = `${record.categorySlug}\0${record.subcategory.slug}\0${record.subcategory.label}`;
    if (seenSub.has(key)) continue;
    seenSub.add(key);
    subcategoryTags.push({ categorySlug: record.categorySlug, ...record.subcategory });
  }
  subcategoryTags.sort(
    (a, b) => a.categorySlug.localeCompare(b.categorySlug) || a.slug.localeCompare(b.slug) || a.label.localeCompare(b.label, "ru"),
  );
  return {
    meta: {
      slugAlgorithm: SLUG_ALGORITHM,
      yearRules: YEAR_RULES,
      imagePattern: IMAGE_PATTERN,
      imagePublicUrl: IMAGE_PUBLIC_URL,
      categories: CATEGORIES.map((category) => category.slug),
    },
    controllers: records,
    categories,
    vocabularies: {
      subcategories: subcategoryTags,
      signalTypes: uniqueTags(records.flatMap((record) => record.signalTypes)),
      inputMethods: uniqueTags(records.flatMap((record) => record.inputMethods)),
      actionCorrespondences: uniqueTags(records.flatMap((record) => record.actionCorrespondences)),
      bodyParts: uniqueTags(records.flatMap((record) => record.bodyParts)),
      countries: uniqueTags(records.flatMap((record) => record.country)),
      decades: uniqueTags(
        records
          .filter((record) => record.decade)
          .map((record) => ({ slug: slugify(record.decade), label: record.decade })),
      ),
    },
    yearExtent: { ...extentOf(records), byCategory },
  };
}

function stripInternal(record) {
  const { _record, ...rest } = record;
  return rest;
}

function main() {
  selfCheck();
  const workbook = loadWorkbook(path.join(ROOT, "controllers_all.xlsx"));
  const sheetNames = workbook.map((sheet) => `${sheet.name}:${sheet.rows.length}`);
  const combined = combinedSheetCheck(workbook);
  const gamesCategory = CATEGORIES[0];
  const records = [];
  const sheetCounts = {};
  for (const category of CATEGORIES) {
    const sheet = workbook.find((item) => item.name === category.sheet);
    if (!sheet) throw new Error(`Missing category sheet ${category.sheet}`);
    sheetCounts[category.slug] = sheet.rows.length;
    for (const row of sheet.rows) {
      const source = sheetRecord(row);
      if (!source.name) continue;
      const record = blankController(category, source);
      record._sheetDecade = source.decade;
      records.push(record);
    }
  }

  const snapshotPath = path.join(ROOT, "data/legacy-controllers.json");
  const oldRecords = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, "utf8")) : parseDataJs(path.join(ROOT, "data.js"));
  const gameCompare = compareGameWorkbook(oldRecords);
  const { matched, unmatched, conflicts } = matchOldRecords(records, oldRecords);
  const added = unmatched.map((old) => recordFromLegacy(old, gamesCategory));
  const gamesIndex = records.reduce((last, record, index) => (record.categorySlug === "games" ? index : last), -1);
  records.splice(gamesIndex + 1, 0, ...added);

  const unmapped = {
    country: new Set(),
    signal: new Set(),
    input: new Set(),
    action: new Set(),
    body: new Set(),
  };
  const subcategoryCollisions = finalizeTags(records, unmapped);
  const slugCollisions = assignControllerSlugs(records);
  for (const match of matched) {
    match.controllerId = match._record.id;
    delete match._record;
  }

  const decadeMismatches = [];
  for (const record of records) {
    const sheetDecade = record.raw.decade;
    if (!sheetDecade || !record.decade) continue;
    const normalized = sheetDecade.toLowerCase().replace(/s$/, "");
    const derived = record.decade.toLowerCase().replace(/s$/, "");
    if (normalized !== derived && sheetDecade !== record.decade) {
      decadeMismatches.push({ id: record.id, sheet: sheetDecade, derived: record.decade, year: record.year });
    }
  }

  const { plans, claimed } = planImageMoves(records);
  const unmatchedImages = collectUnmatched(claimed);
  const moveResults = [];
  if (!DRY) {
    if (!fs.existsSync(snapshotPath)) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, `${JSON.stringify(oldRecords, null, 2)}\n`);
    }
    for (const plan of plans) {
      // The previous photo set can be removed. Discovery then leaves images empty
      // instead of failing, and a later file of any extension still matches the pattern.
      if (plan.absent) {
        moveResults.push({ ...plan, status: "absent", bytes: 0 });
        continue;
      }
      const result = moveFile(plan.src, plan.dest);
      moveResults.push({ ...plan, ...result });
      if (result.status === "missing") {
        throw new Error(`Image disappeared before move: ${plan.src}`);
      }
    }
    for (const src of unmatchedImages) {
      const rel = src.slice("images/".length);
      const dest = path.posix.join("public/images/_unmatched", rel);
      const result = moveFile(src, dest);
      moveResults.push({ src, dest, listed: false, controllerId: null, ...result, unmatched: true });
    }
    removeEmptyDirs(path.join(ROOT, "images"));
  }

  const extensions = {};
  const ignoredFiles = [];
  const overTen = [];
  for (const record of records) {
    const found = DRY ? { urls: [], ignored: [], over: [] } : discoverControllerImages(record);
    record.images = found.urls;
    ignoredFiles.push(...found.ignored);
    if (found.over.length || found.urls.length > 10) {
      overTen.push({ id: record.id, name: record.name, count: found.urls.length, beyond10: found.over });
    }
    for (const url of found.urls) {
      const ext = publicUrlToExt(url);
      extensions[ext] = (extensions[ext] ?? 0) + 1;
    }
  }

  const catalog = buildCatalog(records);
  const missingByCategory = {};
  for (const category of CATEGORIES) missingByCategory[category.slug] = [];
  for (const record of records) {
    if (record.images.length) continue;
    missingByCategory[record.categorySlug].push({
      id: record.id,
      name: record.name,
      year: record.year,
      yearNumber: record.yearNumber,
    });
  }

  let dataJs = null;
  if (!DRY) {
    dataJs = rewriteDataJs(plans);
    fs.writeFileSync(path.join(ROOT, "data/controllers.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  }

  const crossCategory = [];
  const groups = new Map();
  for (const record of records) {
    const key = `${slugify(record.name)}|${record.yearNumber ?? record.year}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    crossCategory.push({
      name: list[0].name,
      year: list[0].year,
      keptAsSeparateRecords: list.map((record) => ({
        id: record.id,
        categorySlug: record.categorySlug,
        manufacturer: record.manufacturer,
      })),
    });
  }

  const counts = {};
  for (const category of CATEGORIES) {
    const finalRows = records.filter((record) => record.categorySlug === category.slug);
    counts[category.slug] = {
      sheet: sheetCounts[category.slug],
      addedFromOld: finalRows.filter((record) => record.recordSource === "legacy").length,
      final: finalRows.length,
    };
  }

  const notableYears = records
    .filter((record) => record.yearPrecision !== "exact" || (record.yearNumber != null && (record.yearNumber < 100 || record.yearNumber < 0)))
    .map((record) => ({
      id: record.id,
      name: record.name,
      year: record.year,
      yearNumber: record.yearNumber,
      yearEnd: record.yearEnd,
      yearPrecision: record.yearPrecision,
      decade: record.decade,
    }));

  const singleTokenInputsUnmapped = [...unmapped.input]
    .filter((label) => !/\s/.test(label) && label.length < 40)
    .sort((a, b) => a.localeCompare(b, "ru"));

  const report = {
    branch: "concept/categories",
    committed: false,
    dryRun: DRY,
    sheets: sheetNames,
    counts: {
      byCategory: counts,
      sheetTotal: Object.values(sheetCounts).reduce((sum, value) => sum + value, 0),
      addedFromOld: added.length,
      final: records.length,
      oldRows: oldRecords.length,
      oldRowsMatched: matched.length,
      oldRowsUnmatched: unmatched.length,
    },
    addedFromOld: added.map((record) => ({
      id: record.id,
      name: record.name,
      year: record.year,
      why: "No new-table row matched normalized name + year + manufacturer. Added to games.",
    })),
    oldRowsMatched: matched.map(stripInternal),
    oldRowsUnmatched: unmatched.map((old) => ({ id: old.id, name: old.name, year: old.year, manufacturer: old.manufacturer })),
    oldFieldsPreserved: LEGACY_FIELDS,
    oldFieldNotes: [
      "Matched old rows keep the full previous record on `legacy`.",
      "source URLs and image page URLs are unioned into sourceUrls and imageUrls, with the workbook value first.",
      "The new workbook stays primary for description, significance, taxonomy, and manufacturer.",
      "innovation, form, designer, generation, paradigm, inputs, buttons, feedback, connection, hands, motion, haptic, wireless, status, experimental, price, and sales exist only on legacy.",
      "Cross-category copies of the same name and year stay separate. The old row is attached only to the best match, which is the games row when name and year agree.",
      "Local files move once, onto that matched row. The copy in another category keeps its spreadsheet image URL and an empty local images array.",
    ],
    conflicts: {
      slugCollisions,
      subcategoryCollisions,
      matchConflicts: conflicts,
      lowManufacturerOverlap: matched
        .filter((match) => match.manufacturerScore != null && match.manufacturerScore < 0.5)
        .map(stripInternal),
      crossCategoryDuplicatesKept: crossCategory,
      decadeLabelMismatches: decadeMismatches,
      combinedSheet: combined,
      gameControllersXlsx: gameCompare,
    },
    normalization: {
      emptyTokens: ["", "—", "–", "-", "н/д", "n/a", "none", "нет"],
      actionSlugs: Object.fromEntries(ACTION),
      signalRule: "Prefix: цифровой→digital, аналоговый→analog, гибрид→hybrid, иное→other. The original cell text, including parentheticals, stays on the tag label.",
      bodyMap: Object.fromEntries(BODY),
      countryMap: "Bilingual aliases share one slug. The tag label is the original cell segment. Parenthetical notes such as '(PrimeSense)' stay on the label and are ignored for the lookup.",
      inputMap: Object.fromEntries(INPUT),
      inputRule: "Only an exact segment is mapped. Longer phrases are transliterated and keep their original label. Cells split on comma, semicolon, plus, and slash; a single-letter slash such as X/Y is kept intact.",
      unmappedCountries: [...unmapped.country].sort((a, b) => a.localeCompare(b, "ru")),
      unmappedSignals: [...unmapped.signal].sort((a, b) => a.localeCompare(b, "ru")),
      unmappedActions: [...unmapped.action].sort((a, b) => a.localeCompare(b, "ru")),
      unmappedBodyParts: [...unmapped.body].sort((a, b) => a.localeCompare(b, "ru")),
      singleTokenInputsUnmapped,
    },
    yearParsing: {
      rules: YEAR_RULES,
      notableYears,
    },
    slugRules: SLUG_ALGORITHM,
    imageStats: {
      pattern: IMAGE_PATTERN,
      publicUrl: IMAGE_PUBLIC_URL,
      plannedMoves: plans.length,
      // Legacy files still on disk, either moved this run or already at the destination.
      relocatedFromPreviousImageFolders: plans.filter((item) => !item.absent).length,
      absentListedImages: plans.filter((item) => item.absent).length,
      stagedGitRenames: stagedRenameCount(),
      movedByGitMvThisRun: moveResults.filter((item) => item.status === "moved").length,
      copiedUntracked: moveResults.filter((item) => item.status === "copied").length,
      alreadyInPlace: moveResults.filter((item) => item.status === "already" || item.status === "dest-exists").length,
      bytesVerified: !DRY,
      note: "Listed photos move once from images/{year}_{name}/ to public/images/{category}/{slug}/{slug}-{yearToken}-{NN}.{ext}. A later run leaves files that are already there and checks sizes. If neither path exists, the photo is absent: discovery records images: [] and does not fail. A file added later is picked up from that same pattern with any extension. There is no image manifest.",
      extensions,
      controllersWithLocalImages: records.filter((record) => record.images.length > 0).length,
      controllersWithoutLocalImages: records.filter((record) => record.images.length === 0).length,
      missingLocalImageCounts: Object.fromEntries(
        Object.entries(missingByCategory).map(([key, value]) => [key, value.length]),
      ),
      missingLocalImages: missingByCategory,
      overTen,
      unrecognizedFiles: ignoredFiles,
      unmatchedOldImages: unmatchedImages.map((src) => ({
        from: src,
        to: `public/images/_unmatched/${src.slice("images/".length)}`,
      })),
      dataJs: dataJs,
    },
    doNotOverwrite: [
      "scripts/build-data.mjs",
      "data/types.ts",
      "data/controllers.ts",
      "data/controllers.json",
      "data/legacy-controllers.json",
      "data/migration-report.json",
      "data/tsconfig.json",
      "public/images/**",
      "controllers_all.xlsx",
      "game_controllers.xlsx",
      "Controller.legacy on matched rows",
      "data.js image paths (local images arrays only list files that exist; imageSources stay)",
    ],
  };

  if (!DRY) {
    fs.writeFileSync(path.join(ROOT, "data/migration-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }

  const summary = {
    dry: DRY,
    sheets: sheetNames,
    final: records.length,
    matched: matched.length,
    added: added.length,
    slugCollisions: slugCollisions.length,
    crossCategory: crossCategory.length,
    plannedMoves: plans.length,
    unmatchedImages: unmatchedImages.length,
    notableYears: notableYears.length,
    gameDiffs: gameCompare.diffs?.length ?? gameCompare.length,
    combinedMismatches: combined.mismatches,
    missing: report.imageStats.missingLocalImageCounts,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (slugCollisions.length) console.log("slug collisions", JSON.stringify(slugCollisions, null, 2));
  if (conflicts.length) console.log("match conflicts", JSON.stringify(conflicts, null, 2));
  if (unmapped.country.size) console.log("unmapped countries", [...unmapped.country]);
  if (unmapped.signal.size) console.log("unmapped signals", [...unmapped.signal]);
  if (unmapped.action.size) console.log("unmapped actions", [...unmapped.action]);
}

main();

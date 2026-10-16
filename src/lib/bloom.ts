const BLOOM_COLORS = ["#FF8BCD", "#FF9900", "#0095FF", "#FB502A", "#20DE86", "#948EFF", "#FFCD29"];

function bloomRand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function bloomPick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function isBloomSpace(char: string) {
  return /\s/.test(char);
}

function canBloomText(text: Text) {
  const parent = text.parentElement;
  if (!parent) return false;
  if (parent.classList.contains("bloom")) return false;
  if (parent.closest("button")) return false;
  if (!parent.closest(".copy")) return false;
  return true;
}

function caretHit(x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    return { node: pos.offsetNode as Text, offset: pos.offset };
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    return { node: range.startContainer as Text, offset: range.startOffset };
  }
  return null;
}

function charRect(text: Text, index: number) {
  const range = document.createRange();
  range.setStart(text, index);
  range.setEnd(text, index + 1);
  return range.getBoundingClientRect();
}

function pickCharIndex(text: Text, offset: number, x: number, y: number) {
  const indexes = [];
  if (offset > 0) indexes.push(offset - 1);
  if (offset < text.data.length) indexes.push(offset);
  let best: number | null = null;
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

function characterNear(copy: Element, x: number, y: number) {
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return canBloomText(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let best: { node: Text; index: number } | null = null;
  let bestDist = Infinity;
  let node = walker.nextNode() as Text | null;
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
    node = walker.nextNode() as Text | null;
  }
  return best;
}

function characterAt(copy: Element, x: number, y: number) {
  const hit = caretHit(x, y);
  if (hit && canBloomText(hit.node) && copy.contains(hit.node)) {
    const index = pickCharIndex(hit.node, hit.offset, x, y);
    if (index != null) return { node: hit.node, index };
  }
  return characterNear(copy, x, y);
}

function paintBloom(element: HTMLElement) {
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

function settleBloom(element: HTMLElement) {
  if (!element.isConnected) return;
  element.removeAttribute("style");
  window.setTimeout(() => unwrapBloom(element), 720);
}

function unwrapBloom(element: HTMLElement) {
  if (!element.isConnected) return;
  const parent = element.parentNode;
  if (!parent) return;
  const text = element.firstChild;
  if (text) parent.insertBefore(text, element);
  element.remove();
  if (parent instanceof HTMLElement && parent.classList.contains("bloom-word") && !parent.querySelector(".bloom")) {
    const host = parent.parentNode;
    if (!host) return;
    while (parent.firstChild) host.insertBefore(parent.firstChild, parent);
    parent.remove();
    host.normalize();
    return;
  }
  parent.normalize();
}

function bloomAt(textNode: Text, index: number) {
  if (!canBloomText(textNode)) return;
  const glyph = textNode.data[index];
  if (!glyph || isBloomSpace(glyph)) return;

  let localIndex = index;
  if (!textNode.parentElement?.classList.contains("bloom-word")) {
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
    wordNode.parentNode?.insertBefore(word, wordNode);
    word.appendChild(wordNode);
    textNode = wordNode;
  }

  const letterNode = localIndex > 0 ? textNode.splitText(localIndex) : textNode;
  if (letterNode.data.length > 1) letterNode.splitText(1);
  const bloom = document.createElement("span");
  bloom.className = "bloom";
  letterNode.parentNode?.insertBefore(bloom, letterNode);
  bloom.appendChild(letterNode);
  paintBloom(bloom);
}

export function attachBloom(root: ParentNode = document) {
  const onMove = (event: Event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType !== "touch" && pointer.buttons) return;
    const target = pointer.target;
    if (!(target instanceof Node)) return;
    const element = target.nodeType === 1 ? (target as Element) : target.parentElement;
    if (!element || element.closest("button")) return;
    const copy = element.closest(".copy");
    if (!copy || !root.contains(copy)) return;
    const found = characterAt(copy, pointer.clientX, pointer.clientY);
    if (!found) return;
    bloomAt(found.node, found.index);
  };
  root.addEventListener("pointermove", onMove);
  return () => root.removeEventListener("pointermove", onMove);
}

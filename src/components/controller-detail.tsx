"use client";

import { useRef, useState } from "react";
import type { Tag } from "@/data/types";
import { withBasePath } from "@/src/lib/base-path";
import type { StudyRecord } from "@/src/lib/study";

function tags(list: Tag[]) {
  return list
    .map((tag) => tag.label.trim())
    .filter(Boolean)
    .join(", ");
}

function Fact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  const text = value.trim();
  if (!text) return null;
  return (
    <div className="record-field">
      <dt className="block-title">{label}</dt>
      <dd className={accent ? "year" : undefined}>{text}</dd>
    </div>
  );
}

function sourceLinks(record: StudyRecord) {
  const seen = new Set<string>();
  const list: string[] = [];
  const add = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    list.push(trimmed);
  };
  for (const url of record.sourceUrls) add(url);
  if (record.images.length === 0) {
    for (const url of record.imageUrls) add(url);
  }
  return list;
}

function isShortSource(urls: string[]) {
  return urls.length > 0 && urls.length <= 2 && urls.every((url) => url.length <= 140);
}

function SourceFact({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="record-field">
      <dt className="block-title">Источник</dt>
      <dd>
        <ul className="record-links">
          {urls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function LocalImages({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState(0);
  const live = images.filter((src) => src && !failed.has(src));
  if (!live.length) return null;
  const index = Math.min(active, live.length - 1);

  const fail = (src: string) =>
    setFailed((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });

  const show = (next: number) => {
    const track = trackRef.current;
    setActive(next);
    const slide = track?.children.item(next);
    if (!track || !(slide instanceof HTMLElement)) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: slide.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="record-gallery">
      <div
        className="record-gallery-track"
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          const left = track.scrollLeft;
          let next = 0;
          let best = Number.POSITIVE_INFINITY;
          for (let i = 0; i < track.children.length; i++) {
            const slide = track.children.item(i);
            if (!(slide instanceof HTMLElement)) continue;
            const distance = Math.abs(slide.offsetLeft - left);
            if (distance < best) {
              best = distance;
              next = i;
            }
          }
          setActive((current) => (current === next ? current : next));
        }}
      >
        {live.map((src) => (
          <div key={src} className="record-gallery-slide">
            <img src={withBasePath(src)} alt="" draggable={false} onError={() => fail(src)} />
          </div>
        ))}
      </div>
      {live.length > 1 ? (
        <div className="record-gallery-thumbs">
          {live.map((src, thumb) => (
            <button
              key={src}
              type="button"
              className="record-gallery-thumb"
              aria-current={thumb === index}
              aria-label={`Снимок ${thumb + 1}`}
              onClick={() => show(thumb)}
            >
              <img src={withBasePath(src)} alt="" draggable={false} onError={() => fail(src)} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ControllerDetail({ record, titleId }: { record: StudyRecord; titleId: string }) {
  const sources = sourceLinks(record);
  const sourceInSpecs = isShortSource(sources);
  const manufacturer = record.manufacturer.trim();
  const showNotes = Boolean(record.significance.trim() || record.description.trim() || (!sourceInSpecs && sources.length));

  return (
    <div className="record-detail" data-controller={record.id}>
      <LocalImages images={record.images} />
      <header className="record-heading">
        <div className="record-field">
          <h2 id={titleId}>{record.name}</h2>
        </div>
        {manufacturer ? (
          <div className="record-field">
            <p className="block-title">Производитель/дизайнер</p>
            <p className="record-value">{manufacturer}</p>
          </div>
        ) : null}
      </header>
      <dl className="record-specs">
        <Fact label="Год" value={record.year} accent />
        <Fact label="Категория" value={record.categoryLabel} />
        <Fact label="Подкатегория" value={record.subcategoryLabel} />
        <Fact label="Страна" value={tags(record.countries)} />
        <Fact label="Тип сигнала" value={tags(record.signalTypes)} />
        <Fact label="Способ ввода" value={tags(record.inputMethods)} />
        <Fact label="Соответствие действию" value={tags(record.actionCorrespondences)} />
        <Fact label="Часть тела" value={tags(record.bodyParts)} />
        <Fact label="Платформа/контекст" value={record.platform} />
        {sourceInSpecs ? <SourceFact urls={sources} /> : null}
      </dl>
      {showNotes ? (
        <dl className="record-notes">
          {sourceInSpecs ? null : <SourceFact urls={sources} />}
          <Fact label="Значимость" value={record.significance} />
          <Fact label="Краткое описание" value={record.description} />
        </dl>
      ) : null}
    </div>
  );
}

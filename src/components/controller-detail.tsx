"use client";

import { useState } from "react";
import type { Tag } from "@/data/types";
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

function LocalImages({ images }: { images: string[] }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const live = images.filter((src) => src && !failed.has(src));
  if (!live.length) return null;
  return (
    <div className="record-images" data-n={live.length}>
      {live.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onError={() =>
            setFailed((current) => {
              if (current.has(src)) return current;
              const next = new Set(current);
              next.add(src);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}

export function ControllerDetail({ record, titleId }: { record: StudyRecord; titleId: string }) {
  const sources = sourceLinks(record);
  return (
    <div className="record-detail" data-controller={record.id}>
      <div className="record-field">
        <p className="block-title">Название</p>
        <h2 id={titleId}>{record.name}</h2>
      </div>
      <LocalImages images={record.images} />
      <dl className="record-fields">
        <Fact label="Производитель/дизайнер" value={record.manufacturer} />
        <Fact label="Год" value={record.year} accent />
        <Fact label="Категория" value={record.categoryLabel} />
        <Fact label="Подкатегория" value={record.subcategoryLabel} />
        <Fact label="Страна" value={tags(record.countries)} />
        <Fact label="Тип сигнала" value={tags(record.signalTypes)} />
        <Fact label="Способ ввода" value={tags(record.inputMethods)} />
        <Fact label="Соответствие действию" value={tags(record.actionCorrespondences)} />
        <Fact label="Часть тела" value={tags(record.bodyParts)} />
        <Fact label="Платформа/контекст" value={record.platform} />
        <Fact label="Краткое описание" value={record.description} />
        <Fact label="Значимость" value={record.significance} />
        {sources.length ? (
          <div className="record-field">
            <dt className="block-title">Источник</dt>
            <dd>
              <ul className="record-links">
                {sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

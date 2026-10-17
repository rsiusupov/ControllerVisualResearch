"use client";

import { useState } from "react";

export function Frames({ images, name }: { images: string[]; name: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const live = (images ?? []).filter((src) => src && !failed.includes(src)).slice(0, 10);

  if (!live.length) {
    return (
      <div className="frames is-empty" data-n="0">
        <p>{name}</p>
      </div>
    );
  }

  const shown = live.slice(0, 4);
  const rest = live.slice(4);
  return (
    <div>
      <div className="frames" data-n={shown.length}>
        {shown.map((src) => (
          <span className="shot" key={src}>
            <img
              src={src}
              alt=""
              onError={() => setFailed((current) => (current.includes(src) ? current : [...current, src]))}
            />
          </span>
        ))}
      </div>
      {rest.length ? (
        <div className="thumbs">
          {rest.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              onError={() => setFailed((current) => (current.includes(src) ? current : [...current, src]))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

import type { CategoryInfo } from "@/data/types";
import { TransitionLink } from "@/src/components/transition-link";
import styles from "./constellation.module.css";

/** Matches the 34% orbit in `.planet` (globals.css). ViewBox units are percentages. */
const ORBIT = 34;

function orbitPoint(index: number) {
  const degrees = index * 60 - 90;
  const radians = (degrees * Math.PI) / 180;
  return {
    degrees,
    x: 50 + Math.cos(radians) * ORBIT,
    y: 50 + Math.sin(radians) * ORBIT,
  };
}

export function Constellation({ categories }: { categories: CategoryInfo[] }) {
  return (
    <div className={`constellation ${styles.root}`}>
      <svg
        className={styles.spokes}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {categories.map((category, index) => {
          const point = orbitPoint(index);
          return (
            <line
              key={category.slug}
              className={styles.spoke}
              x1={50}
              y1={50}
              x2={point.x}
              y2={point.y}
            />
          );
        })}
      </svg>
      <div className="sun" style={{ viewTransitionName: "site-title" }}>
        <h1>Игровые контроллеры</h1>
      </div>
      {categories.map((category, index) => {
        const point = orbitPoint(index);
        return (
          <TransitionLink
            key={category.slug}
            href={`/${category.slug}/`}
            className="planet"
            style={{ ["--angle" as string]: `${point.degrees}deg` }}
            viewTransitionName={`category-${category.slug}`}
          >
            <strong>{category.label}</strong>
          </TransitionLink>
        );
      })}
    </div>
  );
}

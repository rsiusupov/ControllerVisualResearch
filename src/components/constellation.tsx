import type { CategoryInfo } from "@/data/types";
import { TransitionLink } from "@/src/components/transition-link";

export function Constellation({ categories }: { categories: CategoryInfo[] }) {
  return (
    <div className="constellation">
      <div className="sun" style={{ viewTransitionName: "site-title" }}>
        <h1>Игровые контроллеры</h1>
      </div>
      {categories.map((category, index) => (
        <TransitionLink
          key={category.slug}
          href={`/${category.slug}/`}
          className="planet"
          style={{ ["--angle" as string]: `${index * 60 - 90}deg` }}
          viewTransitionName={`category-${category.slug}`}
        >
          <strong>{category.label}</strong>
        </TransitionLink>
      ))}
    </div>
  );
}

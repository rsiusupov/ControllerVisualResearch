import { categories, controllers } from "@/data/controllers";
import { withBasePath } from "@/src/lib/base-path";
import { Constellation } from "@/src/components/constellation";

const SOURCE_COUNT = 20;

function sampleBackgroundImages() {
  const pool: string[] = [];
  for (const record of controllers) {
    if (record.categorySlug !== "games") continue;
    const src = record.images[0];
    if (src) pool.push(withBasePath(src));
  }
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swap];
    pool[swap] = current;
  }
  return pool.slice(0, SOURCE_COUNT);
}

export default function HomePage() {
  return (
    <main className="home">
      <Constellation categories={categories} images={sampleBackgroundImages()} />
    </main>
  );
}

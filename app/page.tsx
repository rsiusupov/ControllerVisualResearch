import { categories } from "@/data/controllers";
import { Constellation } from "@/src/components/constellation";

export default function HomePage() {
  return (
    <main className="home">
      <Constellation categories={categories} />
    </main>
  );
}

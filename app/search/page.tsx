import { Suspense } from "react";
import { categories, controllers, vocabularies } from "@/data/controllers";
import { SearchStudy } from "@/src/components/search-study";
import { toStudy } from "@/src/lib/study";

export const metadata = {
  title: "Поиск — Игровые контроллеры",
};

export default function SearchPage() {
  const records = controllers.map(toStudy);
  return (
    <Suspense fallback={<p className="quiet">Загрузка поиска…</p>}>
      <SearchStudy
        records={records}
        options={{
          categories,
          subcategories: vocabularies.subcategories,
          signalTypes: vocabularies.signalTypes,
          inputMethods: vocabularies.inputMethods,
          actionCorrespondences: vocabularies.actionCorrespondences,
          bodyParts: vocabularies.bodyParts,
          countries: vocabularies.countries,
          decades: vocabularies.decades,
        }}
      />
    </Suspense>
  );
}

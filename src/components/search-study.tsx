"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { CategoryInfo, Tag } from "@/data/types";
import { ControllerCard } from "@/src/components/controller-card";
import {
  EMPTY_QUERY,
  hasActiveQuery,
  paramsFromQuery,
  queryFromParams,
  searchRecords,
  type SearchQuery,
} from "@/src/lib/search";
import type { StudyRecord } from "@/src/lib/study";
import { Button } from "@/src/ui/button";
import { SelectField } from "@/src/ui/select-field";
import { TextField } from "@/src/ui/text-field";

type Options = {
  categories: CategoryInfo[];
  subcategories: Array<Tag & { categorySlug: string }>;
  signalTypes: Tag[];
  inputMethods: Tag[];
  actionCorrespondences: Tag[];
  bodyParts: Tag[];
  countries: Tag[];
  decades: Tag[];
};

export function SearchStudy({ records, options }: { records: StudyRecord[]; options: Options }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = queryFromParams(searchParams);
  const decadeLabel = options.decades.find((item) => item.slug === query.decade)?.label ?? "";
  const matches = useMemo(
    () => searchRecords(records, query, decadeLabel),
    [records, query, decadeLabel],
  );

  function update(patch: Partial<SearchQuery>) {
    const next = { ...query, ...patch };
    const params = paramsFromQuery(next);
    const suffix = params.toString();
    router.replace(suffix ? `/search/?${suffix}` : "/search/", { scroll: false });
  }

  const subcategoryOptions = options.subcategories
    .filter((item) => !query.category || item.categorySlug === query.category)
    .map((item) => ({ value: item.slug, label: item.label }));

  return (
    <main className="search-page">
      <TextField
        id="search-q"
        label="Текст"
        value={query.q}
        placeholder="Название, производитель, платформа, значение"
        onChange={(event) => update({ q: event.target.value })}
      />
      <div className="filters">
        <SelectField
          id="filter-category"
          label="Категория"
          value={query.category}
          options={options.categories.map((item) => ({ value: item.slug, label: item.label }))}
          onChange={(category) => update({ category, subcategory: "" })}
        />
        <SelectField
          id="filter-subcategory"
          label="Подкатегория"
          value={query.subcategory}
          options={subcategoryOptions}
          onChange={(subcategory) => update({ subcategory })}
        />
        <SelectField
          id="filter-signal"
          label="Тип сигнала"
          value={query.signal}
          options={options.signalTypes.map(toOption)}
          onChange={(signal) => update({ signal })}
        />
        <SelectField
          id="filter-input"
          label="Способ ввода"
          value={query.input}
          options={options.inputMethods.map(toOption)}
          onChange={(input) => update({ input })}
        />
        <SelectField
          id="filter-action"
          label="Соответствие действию"
          value={query.action}
          options={options.actionCorrespondences.map(toOption)}
          onChange={(action) => update({ action })}
        />
        <SelectField
          id="filter-body"
          label="Часть тела"
          value={query.body}
          options={options.bodyParts.map(toOption)}
          onChange={(body) => update({ body })}
        />
        <SelectField
          id="filter-country"
          label="Страна"
          value={query.country}
          options={options.countries.map(toOption)}
          onChange={(country) => update({ country })}
        />
        <SelectField
          id="filter-decade"
          label="Десятилетие"
          value={query.decade}
          options={options.decades.map(toOption)}
          onChange={(decade) => update({ decade })}
        />
      </div>
      {hasActiveQuery(query) ? (
        <div className="year-readout">
          <p>
            {matches.length} из {records.length}
          </p>
          <Button type="button" variant="ghost" onClick={() => update(EMPTY_QUERY)}>
            Сбросить
          </Button>
        </div>
      ) : (
        <p className="quiet">{records.length} контроллеров. Введите запрос или выберите фильтр.</p>
      )}
      {hasActiveQuery(query) ? (
        <div className="results">
          {matches.length ? (
            matches.map((record) => <ControllerCard key={record.id} record={record} />)
          ) : (
            <p>Ничего не нашлось.</p>
          )}
        </div>
      ) : null}
    </main>
  );
}

function toOption(tag: Tag) {
  return { value: tag.slug, label: tag.label };
}

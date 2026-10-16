/**
 * Typed catalog of controllers.
 *
 * Import path for the UI: `data/controllers.ts`
 * (generated records live in `data/controllers.json`; regenerate with `npm run data:build`).
 *
 * Do not hand-edit the JSON. Dropping an image file into the controller folder and
 * re-running the data build is enough to change `images`.
 */

export type CategorySlug =
  | "games"
  | "music-sound"
  | "design-digital-art"
  | "photo-film-video"
  | "performance"
  | "interactive-art";

/** How the numeric sort year was derived. Null when the year cell is empty. */
export type YearPrecision = "exact" | "decade" | "circa" | "range";

export type Tag = {
  slug: string;
  label: string;
};

/**
 * Fields from the previous game-controller table (`data.js` / `game_controllers.xlsx`)
 * that the new workbook does not model as their own columns.
 * Present only on the row the old record was matched to. Null on workbook-only rows.
 */
export type LegacyController = {
  id: number;
  year: number;
  decade: string;
  name: string;
  manufacturer: string;
  designer: string | null;
  platform: string;
  generation: string;
  /** Device type from the old table (gamepad, light gun, …), not a study category. */
  category: string;
  paradigm: string;
  inputs: string;
  buttons: string | null;
  feedback: string;
  connection: string;
  form: string;
  body: string;
  hands: string | null;
  motion: string;
  haptic: string;
  wireless: string;
  status: string;
  innovation: string;
  experimental: string;
  price: string | null;
  sales: string | null;
  sources: string[];
  imageSources: string[];
  /** Paths in the previous `images/{year}_{name}/` iteration. */
  images: string[];
};

export type Controller = {
  /** Globally unique. `{categorySlug}/{slug}`. */
  id: string;
  /** Unique within `categorySlug`. */
  slug: string;
  categorySlug: CategorySlug;
  categoryLabel: string;
  /** Verbatim category cell. Longer than `categoryLabel` on some sheets. */
  categoryLabelSource: string;
  subcategory: Tag | null;
  name: string;
  /**
   * «Производитель/дизайнер», or «Автор/студия» on the interactive-art sheet.
   * The old table's separate designer is on `legacy.designer` when matched.
   */
  manufacturer: string;
  /** Original year cell, unchanged. */
  year: string;
  /**
   * Sort key and range bound. BCE is negative.
   * Null only when the year cell is empty (none are, in the current workbook).
   */
  yearNumber: number | null;
  /**
   * End year when `yearPrecision` is `"range"`.
   * Sort order still uses `yearNumber` (the start). Null otherwise.
   */
  yearEnd: number | null;
  yearPrecision: YearPrecision | null;
  /**
   * Derived from `yearNumber`: `"1950s"`, `"80s"`, `"500s BCE"`.
   * Empty when there is no numeric year.
   */
  decade: string;
  country: Tag[];
  signalTypes: Tag[];
  inputMethods: Tag[];
  actionCorrespondences: Tag[];
  bodyParts: Tag[];
  /** Original cells, including placeholders that became empty tag arrays. */
  raw: {
    country: string;
    signal: string;
    input: string;
    action: string;
    body: string;
    decade: string;
  };
  platform: string;
  description: string;
  significance: string;
  sourceUrls: string[];
  /** Page URLs from the spreadsheets. Separate from local `images`. */
  imageUrls: string[];
  /**
   * Public URLs from the build-time folder scan.
   * `/images/{categorySlug}/{slug}/{slug}-{yearToken}-{NN}.{ext}`
   * Empty array when the controller has no local files. Never throws.
   */
  images: string[];
  provenance: string;
  reviewStatus: string;
  /** `workbook` or `legacy` when the row was added because the old table had no match. */
  recordSource: "workbook" | "legacy";
  sheet: string;
  sourceRow: number;
  legacy: LegacyController | null;
};

export type YearExtent = {
  min: number | null;
  max: number | null;
};

export type CategoryInfo = {
  slug: CategorySlug;
  label: string;
  description: string;
  sheet: string;
  count: number;
  yearExtent: YearExtent;
};

export type Vocabularies = {
  subcategories: Array<Tag & { categorySlug: CategorySlug }>;
  signalTypes: Tag[];
  inputMethods: Tag[];
  actionCorrespondences: Tag[];
  bodyParts: Tag[];
  countries: Tag[];
  decades: Tag[];
};

export type CatalogMeta = {
  slugAlgorithm: string;
  yearRules: string[];
  imagePattern: string;
  imagePublicUrl: string;
  categories: CategorySlug[];
};

export type Catalog = {
  meta: CatalogMeta;
  controllers: Controller[];
  categories: CategoryInfo[];
  vocabularies: Vocabularies;
  yearExtent: YearExtent & { byCategory: Record<CategorySlug, YearExtent> };
};

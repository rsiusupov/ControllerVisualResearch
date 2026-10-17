const NAMES = {
  search: "iSearch",
  home: "iHome",
  close: "iClose",
  back: "iArrowLeft",
  filter: "iFilter",
} as const;

export function Icon({ name }: { name: keyof typeof NAMES }) {
  return <i className={NAMES[name]} aria-hidden="true" />;
}

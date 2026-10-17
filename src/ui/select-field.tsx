"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel = "Все",
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={`${option.value}\0${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

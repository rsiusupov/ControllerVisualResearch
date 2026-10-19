"use client";

import type { ComponentProps, ReactNode } from "react";
import { InputField, InputPrefix, InputRoot } from "@/components/ui/input/input";
import { Label } from "@/components/ui/label";

type Props = ComponentProps<"input"> & {
  label: string;
  id: string;
  hiddenLabel?: boolean;
  icon?: ReactNode;
  suffix?: ReactNode;
};

export function TextField({ label, id, hiddenLabel, icon, suffix, ...props }: Props) {
  return (
    <div className="field field-control">
      <Label htmlFor={id} className={hiddenLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <InputRoot>
        {icon ? <InputPrefix>{icon}</InputPrefix> : null}
        <InputField id={id} {...props} />
        {suffix}
      </InputRoot>
    </div>
  );
}

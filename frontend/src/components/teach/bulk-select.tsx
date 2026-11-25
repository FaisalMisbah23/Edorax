"use client";

import { cn } from "@/lib/utils";

export const SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60";

/** A menu in a bulk bar: picking an option applies it to every selected row at once. */
export function BulkSelect({
  label,
  placeholder,
  options,
  onPick,
  disabled,
}: {
  label: string;
  placeholder: string;
  options: Array<[string, string]>;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value=""
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      className={cn(SELECT_CLASS, "border-primary/50 font-medium sm:w-44")}
    >
      <option value="">{placeholder}</option>
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}

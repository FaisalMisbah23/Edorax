"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { coursePriceLabel } from "@/lib/classes";
import type { ClassCourseRef } from "@/shared/api/classes";

const SEARCH_FROM = 6;

export function CoursePicker({
  options,
  selected,
  onChange,
  idPrefix,
}: {
  options: ClassCourseRef[];
  selected: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((course) => course.title.toLowerCase().includes(needle)) : options;

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no published courses yet. Publish a course first, then add it to a class.</p>;
  }

  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

  return (
    <div className="space-y-2">
      {options.length > SEARCH_FROM ? (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your courses"
          aria-label="Search your courses"
          className="h-10"
        />
      ) : null}
      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {shown.map((course) => {
          const id = `${idPrefix}-${course.id}`;
          return (
            <li key={course.id}>
              <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox id={id} checked={selected.includes(course.id)} onCheckedChange={(checked) => toggle(course.id, checked === true)} />
                <span className="min-w-0 flex-1 truncate font-medium">{course.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{coursePriceLabel(course)}</span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No course matches that search.</li> : null}
      </ul>
      <p className="text-xs text-muted-foreground">{selected.length} selected</p>
    </div>
  );
}

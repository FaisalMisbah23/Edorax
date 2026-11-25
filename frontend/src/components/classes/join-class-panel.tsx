"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api-client";
import { errorText } from "@/lib/classes";
import { CLASS_ERROR_CODES, type JoinClassResult } from "@/shared/api/classes";

const PLAIN_ERRORS: Record<string, string> = {
  [CLASS_ERROR_CODES.CLASS_ARCHIVED]: "This class is closed, so no new learners can join.",
  [CLASS_ERROR_CODES.CLASS_ENDED]: "This class has ended, so no new learners can join.",
  [CLASS_ERROR_CODES.OWN_CLASS]: "This is your own class. You do not need to join it. Open it from Classes in your teacher workspace.",
};

export function JoinClassPanel({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinClassResult | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await apiFetch<JoinClassResult>(`/api/v1/classes/join/${encodeURIComponent(code)}`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError && PLAIN_ERRORS[e.code] ? PLAIN_ERRORS[e.code]! : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm font-semibold">You are in this class. Here is what to do next.</p>
        <ul className="space-y-3">
          {result.courses.map((course) => {
            const enrolled = course.state === "active" || course.state === "completed";
            return (
              <li key={course.courseId} className="flex flex-col gap-3 border border-border p-4">
                <p className="font-semibold">{course.title}</p>
                <Link href={enrolled ? `/courses/${course.slug}` : `/catalog/${course.slug}`} className={buttonVariants({ size: "sm", variant: enrolled ? "default" : "outline" })}>
                  {enrolled ? "Start course" : "Get this course"}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/my-classes" className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          See all my classes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" className="w-full" loading={busy} disabled={busy} onClick={() => void join()}>
        Join class
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

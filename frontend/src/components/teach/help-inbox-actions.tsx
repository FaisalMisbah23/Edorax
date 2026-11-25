"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { resolveHelpThread } from "@/server/actions/help";
import { Button } from "@/components/ui/button";

/** Reply or close a learner question straight from the list. */
export function HelpInboxActions({ threadId, open }: { threadId: string; open: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link href={`/help/${threadId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <MessageSquareText className="size-4" aria-hidden /> {open ? "Reply" : "Open"}
      </Link>
      {open ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await resolveHelpThread({ threadId });
              if (!result.ok) setError(result.error);
              else router.refresh();
            })
          }
        >
          <CheckCircle2 aria-hidden /> Mark resolved
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

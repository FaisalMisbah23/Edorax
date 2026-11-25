"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import type { ThreadFeedbackView } from "@/shared/api/teach";
import { setThreadFeedback } from "@/server/actions/help-ai";
import { Button } from "@/components/ui/button";

// Flag a learner question as a problem with the course or the platform, so it lands
// on the Feedback page for the team.

export function HelpFeedbackFlags({ threadId, initialFeedback }: { threadId: string; initialFeedback: ThreadFeedbackView }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flag(scope: "COURSE" | "PLATFORM" | null) {
    startTransition(async () => {
      setError(null);
      const result = await setThreadFeedback({ threadId, scope, note: null });
      if (!result.ok) setError(result.error);
      else {
        setFeedback(result.feedback);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Send to the team as feedback:</span>
      {feedback.scope ? (
        <>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 text-xs font-medium text-amber-800 dark:text-amber-200">
            <Flag className="size-3.5" aria-hidden /> Flagged as {feedback.scope === "PLATFORM" ? "platform" : "course"} problem
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => flag(null)} disabled={pending}>
            Remove flag
          </Button>
        </>
      ) : (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => flag("COURSE")} disabled={pending}>
            <Flag aria-hidden /> Course problem
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => flag("PLATFORM")} disabled={pending}>
            <Flag aria-hidden /> Platform problem
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

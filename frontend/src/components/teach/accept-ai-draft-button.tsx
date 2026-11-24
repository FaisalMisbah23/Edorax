"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { acceptAiReviewDraft } from "@/server/actions/ai-review";
import { Button } from "@/components/ui/button";

/** Sends Claude's first pass unchanged. The mentor has read it on the card above. */
export function AcceptAiDraftButton({ responseId, approve }: { responseId: string; approve: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await acceptAiReviewDraft({ responseId });
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        <Send aria-hidden /> {approve ? "Approve and send" : "Send back with this feedback"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

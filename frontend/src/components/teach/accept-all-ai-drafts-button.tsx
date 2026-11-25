"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { acceptAllAiReviewDrafts } from "@/server/actions/ai-review";
import { Button } from "@/components/ui/button";

/**
 * Sends every drafted review in the list with Claude's suggested verdict. The first tap
 * opens a confirmation in place, with the counts, so nothing is sent by accident.
 */
export function AcceptAllAiDraftsButton({ responseIds, approveCount, reviseCount }: { responseIds: string[]; approveCount: number; reviseCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (responseIds.length === 0) return null;

  function sendAll() {
    startTransition(async () => {
      setMessage(null);
      const result = await acceptAllAiReviewDrafts({ responseIds });
      setConfirming(false);
      if (!result.ok) setMessage(result.error);
      else setMessage(result.failed ? `Sent ${result.sent}. ${result.failed} could not be sent and are still in the list.` : `Sent ${result.sent} reviews.`);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div role="group" aria-label="Confirm sending all drafted reviews" className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">Send {responseIds.length} reviews as Claude wrote them?</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>{approveCount} will be approved.</li>
          <li>{reviseCount} will be sent back for revision.</li>
          <li>Learners see the feedback straight away. This cannot be undone.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={sendAll} loading={pending} disabled={pending}>
            <CheckCheck aria-hidden /> Yes, send {responseIds.length}
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" onClick={() => setConfirming(true)}>
        <CheckCheck aria-hidden /> {responseIds.length === 1 ? "Send the drafted review" : `Send all ${responseIds.length} drafted reviews`}
      </Button>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}

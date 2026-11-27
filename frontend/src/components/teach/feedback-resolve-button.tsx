"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/app-toast";
import { reopenHelpThread, resolveHelpThread } from "@/server/actions/help";

/** Marks one piece of feedback fixed, or opens it again, without leaving the Feedback list. */
export function FeedbackResolveButton({ threadId, status }: { threadId: string; status: "OPEN" | "RESOLVED" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const open = status === "OPEN";

  function toggle() {
    startTransition(async () => {
      const result = open ? await resolveHelpThread({ threadId }) : await reopenHelpThread({ threadId });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(open ? "Marked as resolved." : "Opened again.");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={pending} className="min-h-11 sm:min-h-8">
      {open ? <CheckCircle2 aria-hidden /> : <RotateCcw aria-hidden />}
      {pending ? "Saving..." : open ? "Mark resolved" : "Reopen"}
    </Button>
  );
}

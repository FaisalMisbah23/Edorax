import type { AiGradingView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";
import { AiGradingBoard } from "@/components/teach/ai-grading-board";

// AI grading for every course in one place: a default for all the instructor's courses,
// then a row per course that either uses the default or has its own value.

export const metadata = { title: "AI grading" };

export default async function AiGradingPage() {
  await requireTeachSurface();
  let view: AiGradingView | null = null;
  try {
    view = await serverApiFetch<AiGradingView>("/api/v1/teach/ai-grading");
  } catch (error) {
    // The website can go live a minute before the API does; show a plain note until it catches up.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI grading</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Set AI grading once for all your courses, then change single courses where you need to. Changes save as you make them.
      </p>
      {view?.courses && view.defaults && view.models ? (
        <AiGradingBoard initial={view} />
      ) : (
        <p role="status" className="mt-8 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          This page is being updated. Refresh in a minute.
        </p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { JoinClassPanel } from "@/components/classes/join-class-panel";
import { DateRange } from "@/components/classes/local-date";
import { NOINDEX } from "@/lib/seo";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";
import { coursePriceLabel } from "@/lib/classes";
import { getSessionUser } from "@/server/auth/guards";
import type { ClassJoinPreview } from "@/shared/api/classes";

// Joining a class is a private link, so it stays out of search results.
export const metadata: Metadata = { title: "Join a class", robots: NOINDEX };

export default async function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let preview: ClassJoinPreview;
  try {
    preview = await serverApiFetch<ClassJoinPreview>(`/api/v1/classes/join/${encodeURIComponent(code)}`, { token: null });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <JoinShell title="No class uses this code">
          <p className="text-sm leading-relaxed text-muted-foreground">Check the link your teacher sent you, or ask them for a new one.</p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Go to Edorax
          </Link>
        </JoinShell>
      );
    }
    throw error;
  }

  const user = await getSessionUser();
  const closed = preview.state !== "open";
  const here = `/join/${encodeURIComponent(code)}`;

  return (
    <JoinShell title={`Join ${preview.class.name}`}>
      <div className="mb-6 space-y-3 border border-border p-4">
        <p className="text-sm text-muted-foreground">
          {preview.class.teacherName ? `Taught by ${preview.class.teacherName}` : "A class on Edorax"}
        </p>
        {preview.class.startsAt || preview.class.endsAt ? (
          <p className="text-sm text-muted-foreground">
            <DateRange startsAt={preview.class.startsAt} endsAt={preview.class.endsAt} />
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {preview.courses.map((course) => (
            <li key={course.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
              <span className="min-w-0 font-medium">{course.title}</span>
              <span className="shrink-0 text-muted-foreground">{coursePriceLabel(course)}</span>
            </li>
          ))}
        </ul>
      </div>

      {closed ? (
        <p role="status" className="text-sm leading-relaxed text-muted-foreground">
          {preview.state === "archived" ? "This class is closed, so no new learners can join. Ask your teacher if you think this is a mistake." : "This class has ended, so no new learners can join."}
        </p>
      ) : !user ? (
        <Link href={`/login?redirectTo=${encodeURIComponent(here)}`} className="block">
          <Button className="w-full">Sign in or create an account to join</Button>
        </Link>
      ) : user.role !== "ADMIN" && !user.emailVerified ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Confirm your email address first, then open this link again to join.</p>
          <Link href="/verify-email" className={buttonVariants({ className: "w-full" })}>
            Confirm my email
          </Link>
        </div>
      ) : (
        <JoinClassPanel code={code} />
      )}
    </JoinShell>
  );
}

function JoinShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24">
      <Logo size="lg" />
      <div className="mt-10 w-full max-w-sm">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {children}
      </div>
    </div>
  );
}

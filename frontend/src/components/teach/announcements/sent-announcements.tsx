import { ChevronDown, Megaphone } from "lucide-react";
import type { AnnouncementSummary } from "@/shared/api/course-announcements";
import { learnerCountLabel } from "@/lib/course-announcements";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** The course's past announcements, newest first. Each one opens to show what learners got. */
export function SentAnnouncements({ announcements }: { announcements: AnnouncementSummary[] }) {
  return (
    <section aria-labelledby="sent-announcements" className="space-y-3">
      <h2 id="sent-announcements" className="text-lg font-semibold">Sent announcements</h2>
      {announcements.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border bg-background"><Megaphone className="size-5 text-muted-foreground" aria-hidden /></span>
          <p className="mt-4 text-sm text-muted-foreground">Nothing sent yet. Announcements you send to this course show up here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {announcements.map((item) => (
            <li key={item.id}>
              <details className="group rounded-2xl border bg-card shadow-sm">
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
                      {" · "}
                      {learnerCountLabel(item.recipientCount)}
                      {item.authorName ? ` · by ${item.authorName}` : null}
                    </span>
                  </span>
                  <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-4 border-t px-5 py-4 text-sm leading-6">
                  <p className="whitespace-pre-line break-words">{item.message}</p>
                  {item.steps.length ? (
                    <div>
                      <p className="font-semibold">How to try it</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5">{item.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                    </div>
                  ) : null}
                  {item.images.length ? (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {item.images.map((src, index) => (
                        <li key={src}>
                          <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded image served by the API */}
                            <img src={src} alt={`Screenshot ${index + 1}`} loading="lazy" className="aspect-video w-full object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-muted-foreground">
                    Button: <span className="font-medium text-foreground">{item.ctaLabel}</span>, opens <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">{item.ctaPath}</code>
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

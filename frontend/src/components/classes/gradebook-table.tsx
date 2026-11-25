import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { percentLabel } from "@/lib/classes";
import { LocalDate } from "@/components/classes/local-date";
import type { ClassGradebookView, GradebookCell, GradebookColumn } from "@/shared/api/classes";

type CourseGroup = { courseId: string; title: string; columns: GradebookColumn[] };

function groupColumns(columns: GradebookColumn[]): CourseGroup[] {
  const groups: CourseGroup[] = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    if (last && last.courseId === column.courseId) last.columns.push(column);
    else groups.push({ courseId: column.courseId, title: column.courseTitle, columns: [column] });
  }
  return groups;
}

function cellText(cell: GradebookCell): string {
  if (cell.mark !== null) return percentLabel(cell.mark);
  if (cell.progress !== null) return percentLabel(cell.progress);
  return "None yet";
}

function CellView({ cell }: { cell: GradebookCell }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("font-semibold tabular-nums", cell.late && "text-destructive", cell.mark === null && cell.progress === null && "font-normal text-muted-foreground")}>
        {cellText(cell)}
      </span>
      {cell.mark === null && cell.progress !== null ? <span className="text-[11px] text-muted-foreground">progress</span> : null}
      {cell.late ? <Badge variant="destructive">Late</Badge> : null}
    </div>
  );
}

export function GradebookTable({ classId, gradebook }: { classId: string; gradebook: ClassGradebookView }) {
  const { columns, rows } = gradebook;
  const groups = groupColumns(columns);

  return (
    <section aria-label="Gradebook" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Marks show as a percent when work has been graded, otherwise the progress so far. Late means past the due date and not finished, or finished after it.
          Updated <LocalDate iso={gradebook.generatedAt} withTime />.
        </p>
        {rows.length > 0 ? (
          // Served by the API through the /api/v1 proxy; the session cookie travels with it.
          <a href={`/api/v1/teach/classes/${encodeURIComponent(classId)}/gradebook/export`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
            <Download /> Export spreadsheet
          </a>
        ) : null}
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <h2 className="text-base font-semibold">{rows.length === 0 ? "No learners yet" : "No modules yet"}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {rows.length === 0 ? "Share the join link. Learners show up here as soon as they join." : "The courses in this class have no graded items yet."}
          </p>
        </div>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th rowSpan={2} scope="col" className="sticky left-0 z-20 min-w-44 border-b border-r border-border bg-card px-3 py-2 text-left font-semibold">
                  Learner
                </th>
                {groups.map((group) => (
                  <th key={group.courseId} scope="colgroup" colSpan={group.columns.length} className="border-b border-r border-border bg-muted/40 px-3 py-2 text-left font-semibold">
                    {group.title}
                  </th>
                ))}
                <th rowSpan={2} scope="col" className="border-b border-border px-3 py-2 text-center font-semibold">
                  Late
                </th>
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="min-w-28 border-b border-r border-border px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    <span className="block">{column.label}</span>
                    {column.dueAt ? (
                      <span className="block font-normal">
                        Due <LocalDate iso={column.dueAt} />
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-left font-medium">
                    <span className="block max-w-56 truncate">{row.name}</span>
                    {row.email ? <span className="block max-w-56 truncate text-xs font-normal text-muted-foreground">{row.email}</span> : null}
                  </th>
                  {groups.map((group) => {
                    const present = group.columns.filter((column) => row.cells[column.key]);
                    if (present.length === 0) {
                      return (
                        <td key={group.courseId} colSpan={group.columns.length} className="border-b border-r border-border bg-muted/20 px-3 py-2 text-center text-muted-foreground">
                          Not enrolled
                        </td>
                      );
                    }
                    return group.columns.map((column) => {
                      const cell = row.cells[column.key];
                      return (
                        <td key={column.key} className="border-b border-r border-border px-3 py-2 text-center">
                          {cell ? <CellView cell={cell} /> : <span className="text-muted-foreground">-</span>}
                        </td>
                      );
                    });
                  })}
                  <td className={cn("border-b border-border px-3 py-2 text-center tabular-nums", row.lateCount > 0 && "font-semibold text-destructive")}>{row.lateCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

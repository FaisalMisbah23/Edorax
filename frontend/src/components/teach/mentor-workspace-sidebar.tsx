"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Headphones,
  BookOpenText,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  CircleHelp,
  LayoutDashboard,
  LibraryBig,
  Megaphone,
  Menu,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Flag,
  GraduationCap,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { helpUiCopy } from "@/shared/lib/help-ui-copy";
import type { InstructorAccessView } from "@/shared/lib/instructor-access";

const LAST_COURSE_KEY = "buildment:mentor:last-course";
const LAST_COURSE_EVENT = "buildment:last-course-change";

export type MentorSidebarCourse = {
  id: string;
  slug: string;
  title: string;
  status: string;
  chapterCount: number;
  learnerCount: number;
  pendingReviews: number;
  openHelpRequests: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
  disabled?: boolean;
  /** Never fetch ahead: the target changes state when opened. */
  noPrefetch?: boolean;
};

export function MentorWorkspaceSidebar({
  courses,
  user,
  instructorAccess,
  signOutAction,
}: {
  courses: MentorSidebarCourse[];
  user: { name?: string | null; email?: string | null; role?: string };
  instructorAccess: InstructorAccessView;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeCourseSlug = courseSlugFromPath(pathname, courses);
  const rememberedSlug = useSyncExternalStore(
    subscribeToLastCourse,
    readLastCourse,
    () => null
  );

  useEffect(() => {
    if (routeCourseSlug) {
      writeLastCourse(routeCourseSlug);
    }
  }, [routeCourseSlug]);

  // No course is forced on the instructor: with nothing picked, the workspace is on "All courses".
  const selectedSlug =
    routeCourseSlug ??
    (rememberedSlug && courses.some((course) => course.slug === rememberedSlug) ? rememberedSlug : null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.slug === selectedSlug) ?? null,
    [courses, selectedSlug]
  );
  const courseBase = selectedCourse ? `/courses/${selectedCourse.slug}` : null;

  const workspaceItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/workspace",
      icon: LayoutDashboard,
      active: pathname === "/workspace",
    },
    {
      label: "My courses",
      href: "/courses",
      icon: LibraryBig,
      active: pathname === "/courses",
      count: courses.length,
    },
    {
      label: "Wallet & Payouts",
      href: "/wallet",
      icon: Wallet,
      active: pathname.startsWith("/wallet"),
    },
    {
      label: "Audiobooks",
      href: "/workspace/audiobooks",
      icon: Headphones,
      active: pathname.startsWith("/workspace/audiobooks"),
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Sparkles,
      active: pathname.startsWith("/campaigns"),
    },
  ];
  const courseItems: NavItem[] = [
    {
      label: "Curriculum",
      href: courseBase ? `${courseBase}/edit` : "/courses",
      icon: BookOpenText,
      active:
        Boolean(routeCourseSlug) &&
        (pathname.endsWith("/edit") || pathname.includes("/chapters/")),
      count: selectedCourse?.chapterCount,
      disabled: !selectedCourse,
    },
    {
      label: "Settings",
      href: courseBase ? `${courseBase}/settings` : "/courses",
      icon: Settings2,
      active: Boolean(routeCourseSlug) && pathname.endsWith("/settings"),
      disabled: !selectedCourse,
    },
    {
      label: "Announce",
      href: courseBase ? `${courseBase}/announce` : "/courses",
      icon: Megaphone,
      active: Boolean(routeCourseSlug) && pathname.endsWith("/announce"),
      disabled: !selectedCourse,
    },
  ];
  const insightItems: NavItem[] = [
    {
      label: "Reports",
      href: courseBase ? `${courseBase}/reports` : "/courses",
      icon: BarChart3,
      active: Boolean(routeCourseSlug) && pathname.includes("/reports"),
      disabled: !selectedCourse,
    },
    {
      label: "Daily activity",
      href: courseBase ? `${courseBase}/activity` : "/courses",
      icon: Activity,
      active: Boolean(routeCourseSlug) && pathname.includes("/activity"),
      disabled: !selectedCourse,
    },
  ];
  // Cross-course lists open on all courses; each page has its own course filter.
  const total = (pick: (course: MentorSidebarCourse) => number | undefined) =>
    courses.reduce((sum, course) => sum + (pick(course) ?? 0), 0);
  const workflowItems: NavItem[] = [
    {
      label: "Learners",
      href: "/learners",
      icon: Users,
      active: pathname.startsWith("/learners") || (Boolean(routeCourseSlug) && pathname.includes("/mentees")),
      count: total((course) => course.learnerCount),
    },
    {
      label: "Classes",
      href: "/classes",
      icon: GraduationCap,
      active: pathname.startsWith("/classes"),
    },
    {
      label: "Organisations",
      // Switches to the learner side, where the organisation pages live.
      href: "/open-organizations",
      noPrefetch: true,
      icon: Building2,
      active: pathname.startsWith("/organizations"),
    },
    {
      label: "Answers to check",
      href: "/review",
      icon: MessageSquareText,
      active: pathname.startsWith("/review"),
      count: total((course) => course.pendingReviews),
    },
    {
      label: helpUiCopy.mentorNav,
      href: "/help",
      icon: CircleHelp,
      active: pathname.startsWith("/help"),
      count: total((course) => course.openHelpRequests),
    },
    {
      label: "Feedback",
      href: "/feedback",
      icon: Flag,
      active: pathname.startsWith("/feedback"),
      count: total((course) => course.openFeedback ?? 0),
    },
    {
      label: "AI grading",
      href: "/ai-grading",
      icon: Bot,
      active: pathname.startsWith("/ai-grading"),
    },
  ];

  /** Back to all courses: forget the remembered course and leave any course-only page. */
  const chooseAllCourses = () => {
    clearLastCourse();
    if (routeCourseSlug) router.push("/courses");
    else if (pathname.startsWith("/review")) router.push("/review");
    else if (pathname.startsWith("/help")) router.push("/help");
    else if (pathname.startsWith("/learners")) router.push("/learners");
  };

  const chooseCourse = (course: MentorSidebarCourse) => {
    writeLastCourse(course.slug);

    if (routeCourseSlug) {
      router.push(pathname.replace(`/courses/${routeCourseSlug}`, `/courses/${course.slug}`));
    } else if (pathname.startsWith("/review")) {
      router.push(`/review?courseId=${course.id}`);
    } else if (pathname.startsWith("/help")) {
      router.push(`/help?courseId=${course.id}`);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <WorkspaceAccountMenu current="teach" user={user} instructorAccess={instructorAccess} signOutAction={signOutAction} compact />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-lg border bg-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open mentor workspace navigation"
                />
              }
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[calc(100dvh-5rem)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto p-1.5">
              {/* On a phone the daily work comes first: learners, answers and questions across all courses. */}
              <MobileItems label="All courses" items={workflowItems} router={router} />
              <DropdownMenuSeparator />
              <MobileItems label="Workspace" items={workspaceItems} router={router} />
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Course tools</DropdownMenuLabel>
                {selectedCourse ? (
                  <DropdownMenuItem className="min-h-11 py-2 text-[15px]" onClick={() => router.push("/courses")}>
                    <span className="min-w-0 flex-1 truncate font-medium">{selectedCourse.title}</span>
                    <span className="text-xs font-medium text-primary">Change</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="min-h-11 py-2 text-[15px]" onClick={() => router.push("/courses")}>
                    {courses.length ? "Pick a course to see its tools" : "Create your first course"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              {selectedCourse ? <MobileItems items={[...courseItems, ...insightItems]} router={router} /> : null}
              {user.role === "ADMIN" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem className="min-h-11 py-2 text-[15px]" onClick={() => router.push("/admin")}>
                      <ShieldCheck />
                      <span className="min-w-0 flex-1 truncate">Admin console</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
          <Link href="/workspace" className="inline-flex outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size="sm" />
          </Link>
          <NotificationBell />
        </div>

        <div className="shrink-0 border-b p-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Select course context"
                  disabled={courses.length === 0}
                />
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Active course
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold">
                  {selectedCourse?.title ?? "All courses"}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch course</DropdownMenuLabel>
                <DropdownMenuItem className={cn(!selectedCourse && "bg-accent")} onClick={chooseAllCourses}>
                  <span className="min-w-0 flex-1 truncate font-medium">All courses</span>
                </DropdownMenuItem>
                {courses.map((course) => (
                  <DropdownMenuItem
                    key={course.id}
                    className={cn(course.id === selectedCourse?.id && "bg-accent")}
                    onClick={() => chooseCourse(course)}
                  >
                    <span className="min-w-0 flex-1 truncate">{course.title}</span>
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {course.status.toLowerCase()}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav aria-label="Mentor workspace" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <SidebarGroup label="Workspace" items={workspaceItems} />
          <SidebarGroup label="Course" items={courseItems} />
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="group flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Insights
              <ChevronDown className="size-3.5 transition-transform group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1.5">
              <SidebarItems items={insightItems} />
            </CollapsibleContent>
          </Collapsible>
          <SidebarGroup label="Workflow" items={workflowItems} />
        </nav>

        <div className="shrink-0 border-t p-2">
          <WorkspaceAccountMenu current="teach" user={user} instructorAccess={instructorAccess} signOutAction={signOutAction} />
        </div>
      </aside>
    </>
  );
}

function SidebarGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div>
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5">
        <SidebarItems items={items} />
      </div>
    </div>
  );
}

function SidebarItems({ items }: { items: NavItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const classes = cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          item.active
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          item.disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
        );
        const content = (
          <>
            <Icon className="size-4" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums",
                  item.active ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {item.count > 99 ? "99+" : item.count}
              </span>
            ) : null}
          </>
        );

        return item.disabled ? (
          <span key={item.label} className={classes} aria-disabled="true" title="Pick a course first">
            {content}
          </span>
        ) : (
          <Link key={item.label} href={item.href} prefetch={item.noPrefetch ? false : undefined} aria-current={item.active ? "page" : undefined} className={classes}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function MobileItems({
  label,
  items,
  router,
}: {
  label?: string;
  items: NavItem[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <DropdownMenuGroup>
      {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            className={cn("min-h-11 py-2 text-[15px]", item.active && "bg-accent font-medium")}
            onClick={() => router.push(item.href)}
          >
            <Icon />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined ? (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {item.count > 99 ? "99+" : item.count}
              </Badge>
            ) : null}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuGroup>
  );
}

function courseSlugFromPath(pathname: string, courses: MentorSidebarCourse[]): string | null {
  const match = pathname.match(/^\/courses\/([^/]+)(?:\/|$)/);
  const slug = match?.[1];
  return slug && courses.some((course) => course.slug === slug) ? slug : null;
}

function subscribeToLastCourse(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LAST_COURSE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LAST_COURSE_EVENT, onStoreChange);
  };
}

function readLastCourse(): string | null {
  return window.localStorage.getItem(LAST_COURSE_KEY);
}

function clearLastCourse(): void {
  window.localStorage.removeItem(LAST_COURSE_KEY);
  window.dispatchEvent(new Event(LAST_COURSE_EVENT));
}

function writeLastCourse(slug: string): void {
  if (window.localStorage.getItem(LAST_COURSE_KEY) === slug) return;
  window.localStorage.setItem(LAST_COURSE_KEY, slug);
  window.dispatchEvent(new Event(LAST_COURSE_EVENT));
}

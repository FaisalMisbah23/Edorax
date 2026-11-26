"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  ChapterSidebar as SharedChapterSidebar,
  type ChapterSidebarProps,
} from "@buildment/learning-ui/components/learn/chapter-sidebar";
import { CourseNavigationProvider } from "@buildment/learning-ui/components/learn/course-navigation";
import { moduleVersionActionsFor } from "@/components/learn/module-version-actions";
export { SidebarToggle } from "@buildment/learning-ui/components/learn/chapter-sidebar";

/**
 * Sidebar lesson links do not prefetch. A long course shows dozens of lessons, and prefetching
 * each one renders a whole chapter on the server: on System Design that kept the API busy for
 * 20 seconds after every page load, so a click like a version switch waited behind it.
 */
function SidebarLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}
export function ChapterSidebar(props: ChapterSidebarProps) {
  const [width, setWidth] = useState(288);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("curriculum-sidebar-width"));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores the saved sidebar width from localStorage after mount
      if (saved >= 240 && saved <= 560) setWidth(Math.max(252, saved));
    } catch { /* Keep the default width if storage is unavailable. */ }
  }, []);
  const resize = (value: number) => {
    setWidth(value);
    try { localStorage.setItem("curriculum-sidebar-width", String(value)); } catch { /* Width still changes for this session. */ }
  };
  const router = useRouter();
  const { courseSlug, moduleVersions } = props;
  const hasVersions = Boolean(moduleVersions?.length);
  const versionActions = useMemo(
    () => (hasVersions ? moduleVersionActionsFor(courseSlug, router) : undefined),
    [hasVersions, courseSlug, router]
  );
  const pathname = usePathname();
  const prefix = `/courses/${props.courseSlug}/`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const active = rest && !rest.includes("/") ? decodeURIComponent(rest) : props.currentChapterSlug;
  return (
    <CourseNavigationProvider Link={SidebarLink}>
      <SharedChapterSidebar
        {...props}
        currentChapterSlug={active}
        width={width}
        onWidthChange={resize}
        moduleVersionActions={props.moduleVersionActions ?? versionActions}
      />
    </CourseNavigationProvider>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Menu,
  BookOpen,
  Building2,
  ClipboardList,
  BadgePercent,
  History,
  LayoutDashboard,
  LineChart,
  Receipt,
  MonitorDown,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import { Logo } from "@/components/brand/logo";
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

type AdminNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  badge?: number;
};

export function AdminWorkspaceShell({
  children,
  user,
  pendingRequests,
  organizationCount,
  signOutAction,
}: {
  children: ReactNode;
  user: { name?: string | null; email?: string | null };
  pendingRequests: number;
  organizationCount: number;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navSections: { title: string; items: AdminNavItem[] }[] = [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard, active: pathname === "/admin" },
        { label: "Trends", href: "/admin/trends", icon: LineChart, active: pathname === "/admin/trends" },
      ],
    },
    {
      title: "People & tenants",
      items: [
        { label: "Users", href: "/admin/users", icon: Users, active: pathname.startsWith("/admin/users") },
        {
          label: "Organizations",
          href: "/admin/organizations",
          icon: Building2,
          active: pathname.startsWith("/admin/organizations"),
          badge: organizationCount,
        },
      ],
    },
    {
      title: "Catalog & sales",
      items: [
        { label: "Courses", href: "/admin/courses", icon: BookOpen, active: pathname.startsWith("/admin/courses") },
        { label: "Enrollments", href: "/admin/enrollments", icon: Receipt, active: pathname.startsWith("/admin/enrollments") },
        { label: "Discounts", href: "/admin/discounts", icon: BadgePercent, active: pathname.startsWith("/admin/discounts") },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Course requests",
          href: "/admin/requests",
          icon: ClipboardList,
          active: pathname.startsWith("/admin/requests"),
          badge: pendingRequests,
        },
        {
          label: "Financials & access",
          href: "/admin/course-access",
          icon: Wallet,
          active: pathname.startsWith("/admin/course-access"),
        },
        {
          label: "Desktop updates",
          href: "/admin/desktop-updates",
          icon: MonitorDown,
          active: pathname.startsWith("/admin/desktop-updates"),
        },
        {
          label: "App settings",
          href: "/admin/settings/app",
          icon: SlidersHorizontal,
          active: pathname === "/admin/settings" || pathname.startsWith("/admin/settings/app"),
        },
        { label: "Audit log", href: "/admin/audit", icon: History, active: pathname.startsWith("/admin/audit") },
      ],
    },
  ];

  const currentItem = navSections.flatMap((section) => section.items).find((item) => item.active);

  return (
    <div className="min-h-dvh bg-muted/30 text-foreground">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href="/admin" aria-label="Admin console" className="inline-flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <WorkspaceAccountMenu current="admin" user={{ ...user, role: "ADMIN" }} signOutAction={signOutAction} compact />
            {/* The same menu pattern as the instructor workspace: one button, every section, rows tall enough to tap. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-lg border bg-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Open admin navigation"
                  />
                }
              >
                <Menu className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[calc(100dvh-5rem)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto p-1.5">
                {navSections.map((section, index) => (
                  <div key={section.title}>
                    {index > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem
                            key={item.href}
                            className={cn("min-h-11 py-2 text-[15px]", item.active && "bg-accent font-medium")}
                            onClick={() => router.push(item.href)}
                          >
                            <Icon />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.badge != null && item.badge > 0 ? (
                              <span className="min-w-5 rounded-full bg-primary/10 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-primary">
                                {item.badge > 99 ? "99+" : item.badge}
                              </span>
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="min-h-11 py-2 text-[15px]" onClick={() => router.push("/workspace")}>
                    <GraduationCap />
                    <span className="min-w-0 flex-1 truncate">Instructor workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Where you are, so the menu button is not the only clue on a phone. */}
        {currentItem ? (
          <p className="flex items-center gap-2 border-t px-4 py-2 text-sm font-medium">
            <currentItem.icon className="size-4 text-primary" aria-hidden />
            {currentItem.label}
          </p>
        ) : null}
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/70 bg-card lg:flex">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
          <Link href="/admin" className="inline-flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size="sm" />
            <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Admin console</span>
          </Link>
          <NotificationBell />
        </div>

        <nav aria-label="Platform admin" className="flex-1 space-y-5 overflow-y-auto p-3">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      item.active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge != null && item.badge > 0 ? (
                      <span
                        className={cn(
                          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                          item.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border/70 p-2">
          <WorkspaceAccountMenu current="admin" user={{ ...user, role: "ADMIN" }} signOutAction={signOutAction} />
        </div>
      </aside>

      <main className="min-h-dvh lg:pl-60">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">{children}</div>
      </main>
    </div>
  );
}

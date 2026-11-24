import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MonitorDown } from "lucide-react";
import { SITE_SHARE_IMAGE } from "@/lib/site";
import { AreaHero, AreaPage, AreaSection, StepList } from "@/components/areas/area-page";
import { DesktopDownloadButtons } from "@/components/areas/desktop-download";
import { loadDesktopDownloads, loadShellLab } from "@/lib/shell-labs-server";
import { shellLabMeta } from "@/lib/shell-labs";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const lab = await loadShellLab((await params).slug);
  if (!lab) return { title: "Shell lab" };
  const path = `/labs/shell/${lab.slug}`;
  return {
    title: `${lab.title} (shell lab)`,
    description: lab.summary,
    alternates: { canonical: path },
    openGraph: { title: `${lab.title} on Edorax`, description: lab.summary, url: path, images: [SITE_SHARE_IMAGE] },
  };
}

export default async function ShellLabPage({ params }: { params: Params }) {
  const lab = await loadShellLab((await params).slug);
  if (!lab) notFound();
  const downloads = await loadDesktopDownloads();
  const version = downloads.find((item) => item.version)?.version;

  return (
    <AreaPage>
      <Link
        href="/labs?kind=shell"
        className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-base font-bold text-primary outline-none hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All shell labs
      </Link>

      <AreaHero eyebrow={shellLabMeta(lab)} title={lab.title} mood="determined" intro={lab.scenario ?? lab.summary} />

      <section aria-labelledby="shell-lab-app" className="mt-8 border-2 border-primary bg-card p-6">
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary">
            <MonitorDown className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="shell-lab-app" className="text-xl tracking-[-0.02em]">
              Work on this lab in the desktop app
            </h2>
            <p className="mt-1 max-w-2xl text-base text-muted-foreground">
              Shell labs run on a real machine on your own computer, so they cannot run in the browser. Download the free Edorax desktop app, sign in with
              this account, and open <strong className="text-foreground">{lab.title}</strong> in the Labs tab. Your progress is saved on your account.
            </p>
            <DesktopDownloadButtons className="mt-4" options={downloads} />
            <p className="mt-3 text-sm text-muted-foreground">
              {version ? `Version ${version}. ` : ""}You need Docker Desktop running. The installers are not signed yet, so Windows or macOS may show a warning the first time.{" "}
              <Link href="/labs/shell#desktop" className="font-bold text-primary underline-offset-4 hover:underline">
                How the app works
              </Link>
            </p>
          </div>
        </div>
      </section>

      <AreaSection id="about" title="What you will do" intro={lab.summary}>
        {lab.steps.length > 0 ? (
          <StepList steps={lab.steps.map((step) => ({ title: step.goal, body: "A task with hints and a Check button in the app." }))} />
        ) : (
          <p className="text-base text-muted-foreground">The steps of this lab show in the desktop app.</p>
        )}
      </AreaSection>
    </AreaPage>
  );
}

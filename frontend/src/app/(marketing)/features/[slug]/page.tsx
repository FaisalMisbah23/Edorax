import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SHARE_IMAGE } from "@/lib/site";
import { FeaturePage } from "@/components/marketing/edorax/feature-page";
import { FEATURE_PAGES, featurePath, findFeaturePage } from "@/components/marketing/edorax/feature-pages";

// One landing page per feature, all drawn by the same layout from the entries in feature-pages.ts.
// Built ahead of time; an unknown slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findFeaturePage(slug);
  if (!page) return {};
  const path = featurePath(page.slug);
  return {
    title: page.seo.title,
    description: page.seo.description,
    alternates: { canonical: path },
    openGraph: { title: `${page.seo.title} · Edorax`, description: page.seo.description, url: path, images: [SITE_SHARE_IMAGE] },
  };
}

export default async function FeatureLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findFeaturePage(slug);
  if (!page) notFound();
  return <FeaturePage page={page} />;
}

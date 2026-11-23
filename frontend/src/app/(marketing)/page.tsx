import type { Metadata } from "next";
import { SITE_NAME, SITE_SHARE_IMAGE, SITE_URL } from "@/lib/site";
import { EdoraxLanding } from "@/components/marketing/edorax/edorax-landing";
import { getSessionUser } from "@/server/auth/guards";
import { homeRouteForRole } from "@/server/auth/access-rules";

export const metadata: Metadata = {
  title: { absolute: "Edorax: every lesson starts with a question" },
  description: "Courses you read, play, hear and prove, plus visual, guided and shell labs. Try every kind from the home page, no account needed.",
  alternates: { canonical: "/" },
  openGraph: { title: "Edorax: every lesson starts with a question", url: "/", images: [SITE_SHARE_IMAGE] },
};

// WebSite and Organization markup so Google shows "Edorax" as the site name, with the Edorax mark.
const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: "edorax.com",
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
    },
  ],
};

export default async function HomePage() {
  const user = await getSessionUser();
  const dashboardHref = user ? homeRouteForRole(user.role) : null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }} />
      <EdoraxLanding dashboardHref={dashboardHref} />
    </>
  );
}

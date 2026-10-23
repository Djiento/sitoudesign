
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ContentPage from "@/components/sections/ContentPage";
import PortfolioProjects from "@/components/sections/PortfolioProjects";
import { getPageContent } from "@/lib/page-content";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function RealisationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const data = getPageContent(raw, "realisations");

  return (
    <ContentPage
      locale={raw}
      variant="portfolio"
      {...data}
      cards={[]}
      afterIntro={
        <section className="content-section portfolio-section">
          <div className="content-wrap">
            <div className="section-heading">
              <span className="eyebrow">
                {raw === "en" ? "Selected work" : "Projets sélectionnés"}
              </span>
              <h2>{data.sectionTitle}</h2>
              <p>{data.sectionDescription}</p>
            </div>
            <Suspense fallback={<p className="portfolio-empty">{raw === "en" ? "Loading projects..." : "Chargement des réalisations..."}</p>}>
              <PortfolioProjects locale={raw} />
            </Suspense>
          </div>
        </section>
      }
    />
  );
}

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PortfolioProjects from "@/components/sections/PortfolioProjects";
import { isLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/lib/page-content";
import { managedImageUrl } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default function HomePage({ params }: HomePageProps) {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent params={params} />
    </Suspense>
  );
}

function HomePageFallback() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <span className="eyebrow">Sitou Design · Bénin</span>
            <h1>Vos idées méritent de <span>se faire remarquer.</span></h1>
          </div>
          <div className="home-artwork" aria-hidden="true">
            <div className="artwork-poster artwork-poster-orange">
              <span>VOTRE MARQUE</span>
              <strong>Faites<br />bonne<br />impression.</strong>
              <i>DESIGN · PRINT · IMPACT</i>
            </div>
            <div className="artwork-poster artwork-poster-blue">
              <span>STUDIO CRÉATIF</span>
              <strong>Donnez<br />forme à<br />vos idées.</strong>
              <i>ABJ · COTONOU · PARTOUT</i>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

async function HomePageContent({ params }: HomePageProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const en = locale === "en";
  const [services, featuredProducts, solutions, articles] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 4,
      include: {
        category: {
          select: {
            nameFr: true,
            nameEn: true,
            slug: true,
            coverImage: true,
          },
        },
        media: {
          where: { type: "IMAGE" },
          orderBy: { sortOrder: "asc" },
          select: { url: true, altFr: true, altEn: true },
        },
      },
    }),
    prisma.businessSolution.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 3,
    }),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        slug: true,
        category: true,
        titleFr: true,
        titleEn: true,
        excerptFr: true,
        excerptEn: true,
        coverImage: true,
      },
    }),
  ]);

  const fallbackServices = getPageContent(locale, "services").cards;
  const serviceCards = (services.length ? services : fallbackServices).map(
    (service) => ({
      title: "titleFr" in service
        ? en ? service.titleEn : service.titleFr
        : service.title,
      description: "descriptionFr" in service
        ? en ? service.descriptionEn : service.descriptionFr
        : service.description,
      image: "coverImage" in service
        ? managedImageUrl(service.coverImage, "service", service.slug)
        : service.image ?? null,
      href: "slug" in service
        ? `/${locale}/devis?service=${encodeURIComponent(service.slug)}`
        : service.href,
    }),
  );

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <span className="eyebrow">
              {en ? "Creative studio · Benin" : "Studio créatif · Bénin"}
            </span>
            <h1>
              {en ? (
                <>Your ideas deserve to <span>stand out.</span></>
              ) : (
                <>Vos idées méritent de <span>se faire remarquer.</span></>
              )}
            </h1>
            <p>
              {en
                ? "We bring your brand to life with thoughtful design, beautiful print and communication that gets noticed."
                : "Nous donnons vie à votre marque avec du design soigné, de belles impressions et une communication qui attire le regard."}
            </p>
            <div className="hero-actions">
              <Link href={`/${locale}/devis`} className="btn btn-primary home-hero-primary">
                {en ? "Tell us about your project" : "Parlons de votre projet"}
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
              <Link href={`/${locale}/realisations`} className="home-hero-secondary">
                {en ? "See what we create" : "Voir nos réalisations"}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            <div className="home-hero-note">
              <span className="home-note-mark" aria-hidden="true">✳</span>
              <span>
                {en
                  ? "From the first sketch to the finished print."
                  : "Du premier croquis au support finalisé."}
              </span>
            </div>
          </div>

          <div
            className="home-artwork"
            aria-label={en ? "Creative studio print and design preview" : "Aperçu de création graphique et impression"}
          >
            <div className="artwork-orbit artwork-orbit-one" aria-hidden="true" />
            <div className="artwork-orbit artwork-orbit-two" aria-hidden="true" />
            <div className="artwork-label">
              <span>SITOU DESIGN</span>
              <span>01 — 03</span>
            </div>
            <div className="artwork-poster artwork-poster-orange">
              <span>{en ? "YOUR BRAND" : "VOTRE MARQUE"}</span>
              <strong>{en ? <>Make a<br />good<br />impression.</> : <>Faites<br />bonne<br />impression.</>}</strong>
              <i>DESIGN · PRINT · IMPACT</i>
            </div>
            <div className="artwork-poster artwork-poster-blue">
              <span>{en ? "CREATIVE STUDIO" : "STUDIO CRÉATIF"}</span>
              <strong>{en ? <>Make it<br />matter.</> : <>Donnez forme<br />à vos idées.</>}</strong>
              <i>ABJ · COTONOU · PARTOUT</i>
            </div>
            <div className="artwork-card">
              <span className="artwork-card-symbol">S.</span>
              <span>SITOU<br />DESIGN</span>
              <i>CRÉER · IMPRIMER</i>
            </div>
            <div className="artwork-stamp">
              <span>LES IDÉES</span>
              <strong>PRENNENT<br />FORME</strong>
              <i>✳</i>
            </div>
            <div className="artwork-caption">
              {en ? "A little more you, on every medium." : "Un peu plus vous, sur chaque support."}
            </div>
          </div>
        </div>
        <div className="home-hero-bottom">
          <span>{en ? "A creative partner from idea to impact" : "Un partenaire créatif, de l’idée à l’impact"}</span>
          <div><span>IDENTITÉ</span><i /> <span>IMPRESSION</span><i /> <span>VISIBILITÉ</span></div>
        </div>
      </section>

      <section className="home-services content-section">
        <div className="content-wrap">
          <div className="home-section-topline">
            <div className="section-heading home-section-heading">
              <span className="eyebrow">{en ? "What we do" : "Ce que nous faisons"}</span>
              <h2>{en ? "Good design. Made real." : "De belles idées, rendues concrètes."}</h2>
              <p>
                {en
                  ? "One creative team for the details people notice and the materials they take home."
                  : "Une équipe créative pour les détails qui attirent l’œil et les supports que l’on garde."}
              </p>
            </div>
            <Link href={`/${locale}/services`} className="home-text-link">
              {en ? "Discover all services" : "Tous nos services"}
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <div className="home-service-grid">
            {serviceCards.map((service, index) => (
              <article
                className="home-service-card"
                key={`${service.title}-${index}`}
              >
                <Link
                  className="home-card-link-overlay"
                  href={service.href ?? `/${locale}/services`}
                  aria-label={service.title}
                  tabIndex={-1}
                />
                <div className={`home-service-visual home-service-visual-${index % 4}`}>
                  {service.image ? (
                    <ImageGallery
                      locale={locale}
                      images={[{ src: service.image, alt: service.title }]}
                      className="home-service-image-gallery"
                      imageClassName="home-service-image"
                    />
                  ) : (
                    <div className="home-service-shape" aria-hidden="true">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <i />
                    </div>
                  )}
                  <span className="home-service-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="home-service-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
                </div>
                <div className="home-service-copy">
                  <h3><Link href={service.href ?? `/${locale}/services`}>{service.title}</Link></h3>
                  <p>{service.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-statement">
        <div className="content-wrap home-statement-inner">
          <span className="home-statement-star" aria-hidden="true">✳</span>
          <p>
            {en
              ? <>A brand people remember starts with <em>the details.</em></>
              : <>Une marque dont on se souvient commence par <em>les détails.</em></>}
          </p>
          <Link href={`/${locale}/solutions-entreprises`}>
            {en ? "Build a consistent brand" : "Construire une marque cohérente"}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="content-section home-products">
          <div className="content-wrap">
            <div className="home-section-topline">
              <div className="section-heading home-section-heading">
                <span className="eyebrow">{en ? "Made for your brand" : "À votre image"}</span>
                <h2>{en ? "Little things. Big first impressions." : "Les bons supports font toute la différence."}</h2>
                <p>{en ? "Explore a selection of print, signage and custom pieces." : "Découvrez des supports imprimés, de la signalétique et des créations à personnaliser."}</p>
              </div>
              <Link href={`/${locale}/catalogue`} className="home-text-link">
                {en ? "Explore the catalogue" : "Tout le catalogue"}
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </div>
            <div className="card-grid home-product-grid">
              {featuredProducts.map((product, index) => (
                <article className="home-product-card" key={product.id}>
                  <Link
                    className="home-card-link-overlay"
                    href={`/${locale}/catalogue/${product.slug}`}
                    aria-label={en ? product.nameEn : product.nameFr}
                    tabIndex={-1}
                  />
                  <div className="home-product-visual">
                    {(product.media.length > 0 || product.category.coverImage) && (
                      <ImageGallery
                        locale={locale}
                        images={product.media.length
                          ? product.media.map((media) => ({
                              src: managedImageUrl(media.url, "product", product.slug) ?? media.url,
                              alt: (en ? media.altEn : media.altFr) || (en ? product.nameEn : product.nameFr),
                            }))
                          : product.category.coverImage
                            ? [{
                                src: managedImageUrl(product.category.coverImage, "category", product.category.slug) ?? product.category.coverImage,
                                alt: en ? product.category.nameEn : product.category.nameFr,
                              }]
                            : []}
                        className="home-product-image-gallery"
                        imageClassName="home-product-image"
                        displayCount={1}
                      />
                    )}
                    <span>{en ? product.category.nameEn : product.category.nameFr}</span>
                    <i aria-hidden="true"><ArrowUpRight size={18} /></i>
                  </div>
                  <div className="home-product-copy">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3><Link href={`/${locale}/catalogue/${product.slug}`}>{en ? product.nameEn : product.nameFr}</Link></h3>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="content-section home-projects">
        <div className="content-wrap">
          <div className="home-section-topline">
            <div className="section-heading home-section-heading">
              <span className="eyebrow">{en ? "Selected work" : "Quelques réalisations"}</span>
              <h2>{en ? "Made with care. Made to be seen." : "Pensé avec soin. Fait pour être vu."}</h2>
              <p>{en ? "A glimpse of the identities and materials we have helped bring to life." : "Un aperçu des identités et des supports que nous avons imaginés et réalisés."}</p>
            </div>
            <Link href={`/${locale}/realisations`} className="home-text-link">
              {en ? "See all projects" : "Toutes les réalisations"}
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <Suspense fallback={<p className="portfolio-empty">{en ? "Loading projects..." : "Chargement des réalisations..."}</p>}>
            <PortfolioProjects locale={locale} limit={3} />
          </Suspense>
        </div>
      </section>

      {solutions.length > 0 && (
        <section className="home-solutions">
          <div className="content-wrap">
            <div className="home-solutions-intro">
              <span className="eyebrow">{en ? "For your business" : "Pour votre entreprise"}</span>
              <h2>{en ? "One brand. Every touchpoint." : "Votre identité, partout où elle compte."}</h2>
              <p>
                {en
                  ? "From the first business card to your storefront, we make your brand feel like one."
                  : "De votre première carte de visite à votre vitrine, nous faisons vivre une identité qui vous ressemble."}
              </p>
              <Link href={`/${locale}/solutions-entreprises`} className="home-solutions-link">
                {en ? "Explore business solutions" : "Découvrir les solutions entreprises"}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
            <div className="home-solution-list">
              {solutions.map((solution, index) => (
                <article className="home-solution-item" key={solution.id}>
                  <Link
                    href={`/${locale}/solutions-entreprises`}
                    className="home-solution-link-overlay"
                    aria-label={en ? `Explore ${solution.titleEn}` : `Découvrir : ${solution.titleFr}`}
                    tabIndex={-1}
                  />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {solution.coverImage ? (
                    <ImageGallery
                      locale={locale}
                      images={[{
                        src: managedImageUrl(solution.coverImage, "business-solution", solution.slug) ?? solution.coverImage,
                        alt: en ? solution.titleEn : solution.titleFr,
                      }]}
                      className="home-solution-image-gallery"
                      imageClassName="home-solution-image"
                    />
                  ) : (
                    <div className="home-solution-image-placeholder" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  )}
                  <div>
                    <h3>{en ? solution.titleEn : solution.titleFr}</h3>
                    <p>{en ? solution.descriptionEn : solution.descriptionFr}</p>
                  </div>
                  <ArrowUpRight aria-hidden="true" size={19} />
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section className="content-section home-advice">
          <div className="content-wrap">
            <div className="home-section-topline">
              <div className="section-heading home-section-heading">
                <span className="eyebrow">{en ? "Notes from the studio" : "Conseils du studio"}</span>
                <h2>{en ? "A few ideas to get you started." : "Quelques idées pour bien commencer."}</h2>
              </div>
              <Link href={`/${locale}/conseils`} className="home-text-link">
                {en ? "Read all our advice" : "Tous nos conseils"}
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </div>
            <div className="home-advice-grid">
              {articles.map((article, index) => (
                <article className="home-advice-card" key={article.slug}>
                  <Link
                    className="home-card-link-overlay"
                    href={`/${locale}/conseils/${article.slug}`}
                    aria-label={en ? article.titleEn : article.titleFr}
                    tabIndex={-1}
                  />
                  <div className={`home-advice-image home-advice-image-${index % 3}`}>
                    {article.coverImage && (
                      <ImageGallery
                        locale={locale}
                        images={[{
                          src: managedImageUrl(article.coverImage, "article", article.slug) ?? article.coverImage,
                          alt: en ? article.titleEn : article.titleFr,
                        }]}
                        className="home-advice-image-gallery"
                        imageClassName="home-advice-image-photo"
                      />
                    )}
                    <span>{article.category}</span>
                  </div>
                  <div className="home-advice-copy">
                    <h3><Link href={`/${locale}/conseils/${article.slug}`}>{en ? article.titleEn : article.titleFr}</Link></h3>
                    <p>{en ? article.excerptEn : article.excerptFr}</p>
                    <Link href={`/${locale}/conseils/${article.slug}`}>{en ? "Read the note" : "Lire le conseil"} <ArrowRight aria-hidden="true" size={15} /></Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-cta">
        <div className="home-cta-shape" aria-hidden="true" />
        <div className="home-cta-content">
          <span>{en ? "Your next big idea starts here" : "Votre prochaine idée commence ici"}</span>
          <h2>{en ? "Let’s make something people remember." : "Créons quelque chose dont on se souvient."}</h2>
          <p>
            {en
              ? "Tell us what you have in mind. We will help you choose the right way to bring it to life."
              : "Racontez-nous votre idée. Nous vous aiderons à trouver la meilleure façon de lui donner vie."}
          </p>
          <div className="home-cta-actions">
            <Link href={`/${locale}/devis`} className="btn home-cta-primary">
              {en ? "Start a project" : "Parler de mon projet"}
              <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
            <Link href={`/${locale}/contact`} className="home-cta-secondary">
              {en ? "Contact our team" : "Contacter notre équipe"}
            </Link>
          </div>
        </div>
        <div className="home-cta-stamp" aria-hidden="true">
          <span>SITOU</span>
          <strong>DESIGN</strong>
          <i>✳</i>
        </div>
      </section>
    </main>
  );
}

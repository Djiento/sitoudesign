
export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocale(value: string): Locale {
  return isLocale(value) ? value : "fr";
}

export const dictionaries = {
  fr: {
    nav: {
      home: "Accueil",
      catalogue: "Catalogue",
      portfolio: "Réalisations",
      services: "Services",
      business: "Solutions entreprises",
      advice: "Conseils",
      contact: "Contact",
      quote: "Demander un devis",
    },
    common: {
      discover: "Découvrir",
      viewAll: "Voir tout",
      learnMore: "En savoir plus",
      contactUs: "Parlons de votre projet",
    },
  },
  en: {
    nav: {
      home: "Home",
      catalogue: "Catalogue",
      portfolio: "Our work",
      services: "Services",
      business: "Business solutions",
      advice: "Insights",
      contact: "Contact",
      quote: "Request a quote",
    },
    common: {
      discover: "Discover",
      viewAll: "View all",
      learnMore: "Learn more",
      contactUs: "Let's discuss your project",
    },
  },
} as const;

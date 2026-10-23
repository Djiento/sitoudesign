import type { Locale } from "@/lib/i18n";

export type Insight = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  sections: string[];
};

const insights: Record<Locale, Insight[]> = {
  fr: [
    {
      slug: "preparer-fichier-impression",
      category: "Impression",
      title: "Bien préparer un fichier pour l'impression",
      excerpt: "Les vérifications essentielles pour obtenir un document net et fidèle à votre création.",
      sections: [
        "Avant l’envoi, vérifiez le format final du document et ajoutez les fonds perdus demandés par l’imprimeur. Ils évitent l’apparition d’un fin liseré blanc après la coupe.",
        "Gardez les textes et les éléments importants à l’intérieur d’une marge de sécurité. Pensez aussi à incorporer les polices ou à vectoriser les textes lorsque c’est nécessaire.",
        "Pour les photographies, contrôlez la résolution à la taille réelle d’impression. Un visuel qui paraît net à l’écran peut devenir flou une fois agrandi.",
        "Exportez un PDF prêt à imprimer et vérifiez-le à fort zoom avant de le transmettre. En cas de doute sur les réglages, demandez un contrôle du fichier avant le lancement.",
      ],
    },
    {
      slug: "choisir-support-publicitaire",
      category: "Communication",
      title: "Choisir le bon support publicitaire",
      excerpt: "Adaptez le format, la matière et le message au public que vous souhaitez toucher.",
      sections: [
        "Commencez par définir l’objectif : informer, faire découvrir une offre, guider les visiteurs ou laisser un souvenir. Le support découle de cet usage.",
        "Un flyer convient à une information courte et diffusée largement. Une brochure permet de détailler plusieurs services, tandis qu’une affiche doit rester lisible en quelques secondes.",
        "Pensez au contexte de consultation : distance, durée, intérieur ou extérieur, fréquence d’utilisation. Ces éléments influencent le format, le papier et les finitions.",
        "Enfin, privilégiez un message principal, une hiérarchie simple et un appel à l’action clair. Un support efficace n’essaie pas de tout dire à la fois.",
      ],
    },
    {
      slug: "image-de-marque",
      category: "Identité visuelle",
      title: "Créer une image de marque cohérente",
      excerpt: "Quelques repères pour rendre votre identité reconnaissable sur tous vos supports.",
      sections: [
        "Une identité cohérente repose sur des choix répétés : logo, couleurs, typographies, style d’images et ton éditorial. Ces repères doivent rester simples à appliquer.",
        "Préparez des variantes de logo adaptées aux fonds clairs et foncés, ainsi qu’une version compacte pour les petits formats. Évitez de modifier ses proportions ou ses couleurs au cas par cas.",
        "Définissez une palette courte et une hiérarchie typographique lisible. La cohérence ne signifie pas que chaque support doit être identique, mais qu’ils doivent être immédiatement associés à la même marque.",
        "Rassemblez ces règles dans un guide pratique et partagez-le avec les personnes qui produisent vos supports.",
      ],
    },
    {
      slug: "resolution-image-impression",
      category: "Impression",
      title: "Quelle résolution choisir pour une impression nette ?",
      excerpt: "Comprenez les DPI et vérifiez vos images à leur taille d’impression réelle.",
      sections: [
        "La résolution utile dépend de la distance de lecture. Pour un document tenu à la main, une image autour de 300 DPI à sa taille finale est une bonne référence.",
        "Pour une affiche ou un visuel grand format regardé de loin, une résolution inférieure peut suffire. L’essentiel est d’évaluer le fichier une fois placé à sa dimension réelle.",
        "Agrandir artificiellement une petite image ne recrée pas les détails manquants. Si le visuel doit être redimensionné fortement, cherchez une source de meilleure qualité ou une version vectorielle.",
        "Avant l’impression, vérifiez les dimensions en pixels et faites un aperçu à 100 %. Les captures d’écran et images téléchargées depuis les réseaux sociaux sont souvent trop compressées.",
      ],
    },
    {
      slug: "fonds-perdus-marges-securite",
      category: "Préparation de fichier",
      title: "Fonds perdus et marges de sécurité : quelle différence ?",
      excerpt: "Deux repères simples qui évitent les bords blancs et les textes trop proches de la coupe.",
      sections: [
        "Le fond perdu prolonge les couleurs et les images au-delà du format final. Il compense les petites variations de coupe et évite qu’un bord blanc apparaisse.",
        "La marge de sécurité fonctionne à l’inverse : elle maintient les textes, logos et éléments importants à distance du bord de coupe.",
        "Les valeurs exactes varient selon le produit et le procédé d’impression. Suivez toujours les indications fournies pour votre commande plutôt qu’une valeur universelle.",
        "Dans votre logiciel, affichez les repères de coupe et exportez le PDF avec les fonds perdus requis. Contrôlez ensuite que le fond couvre bien toute la zone prévue.",
      ],
    },
    {
      slug: "cmjn-rvb-impression",
      category: "Couleurs",
      title: "CMJN ou RVB : préparer les bonnes couleurs",
      excerpt: "Pourquoi les couleurs d’écran peuvent différer du résultat imprimé et comment l’anticiper.",
      sections: [
        "Les écrans utilisent la lumière en RVB, tandis que l’impression courante combine des encres en CMJN. Les deux espaces ne peuvent pas reproduire exactement toutes les couleurs.",
        "Un bleu très lumineux ou un orange saturé à l’écran peut paraître plus mat sur papier. Le rendu dépend aussi du support, de la finition et de la machine utilisée.",
        "Préparez votre fichier selon le profil colorimétrique recommandé par l’imprimeur. Évitez les conversions répétées, qui peuvent modifier les teintes.",
        "Pour une couleur de marque essentielle, demandez un bon à tirer ou un échantillon sur le support prévu. C’est la meilleure façon de valider le rendu réel.",
      ],
    },
    {
      slug: "choisir-papier-impression",
      category: "Supports",
      title: "Comment choisir le papier de vos supports ?",
      excerpt: "Grammage, texture et finition : choisissez selon l’usage plutôt que le chiffre seul.",
      sections: [
        "Le grammage donne une indication sur le poids du papier, mais pas à lui seul sur son toucher ou sa rigidité. Le type de papier et sa finition comptent également.",
        "Pour un flyer distribué en grande quantité, un papier léger peut être adapté. Pour une carte de visite ou une couverture, une feuille plus épaisse donne davantage de tenue.",
        "Le papier couché met en valeur les photos et les couleurs. Un papier non couché offre un toucher plus naturel et facilite souvent l’écriture au stylo.",
        "Si vous hésitez, comparez des échantillons dans vos mains et tenez compte du budget, de la durée d’usage et de l’image que vous voulez transmettre.",
      ],
    },
    {
      slug: "concevoir-flyer-efficace",
      category: "Design graphique",
      title: "Concevoir un flyer clair et efficace",
      excerpt: "Structurez votre message pour qu’il soit compris en un coup d’œil.",
      sections: [
        "Commencez par une promesse ou une information principale, formulée simplement. Le lecteur doit comprendre le sujet avant de s’arrêter sur les détails.",
        "Organisez le contenu en trois niveaux : titre, informations utiles, puis coordonnées ou appel à l’action. Laissez suffisamment d’espace autour de chaque bloc.",
        "Utilisez un contraste marqué et une taille de texte adaptée à la distance de lecture. Limitez le nombre de polices et d’effets décoratifs.",
        "Avant l’impression, vérifiez les dates, prix, numéros de téléphone, liens et conditions de l’offre. Une relecture par une autre personne permet souvent de repérer un oubli.",
      ],
    },
    {
      slug: "signaletique-lisible",
      category: "Signalétique",
      title: "Rendre votre signalétique lisible à distance",
      excerpt: "Quelques règles de contraste, de taille et de placement pour guider efficacement.",
      sections: [
        "Déterminez d’abord à quelle distance et depuis quel angle le message sera lu. La taille des caractères doit être pensée pour cet emplacement, pas seulement sur l’écran de conception.",
        "Choisissez un contraste suffisant entre le texte et le fond. Évitez les textes fins sur des fonds chargés, les reflets gênants et les informations secondaires trop nombreuses.",
        "Placez les éléments dans l’ordre utile : nom ou destination, indication principale, puis détails. Une personne en déplacement doit saisir l’essentiel rapidement.",
        "Sur site, vérifiez la visibilité avec l’éclairage réel et les obstacles environnants. Un aperçu à l’échelle ou un test d’impression aide à valider le résultat.",
      ],
    },
    {
      slug: "textile-personnalise-durable",
      category: "Textile",
      title: "Bien choisir un textile personnalisé",
      excerpt: "Pensez à l’usage, au confort et à la technique de marquage avant de commander.",
      sections: [
        "Choisissez le vêtement selon son usage : tenue quotidienne, événement ponctuel, travail en extérieur ou uniforme. Le confort et la facilité d’entretien comptent autant que l’apparence.",
        "La technique de marquage dépend du textile, du visuel, des couleurs et de la quantité. Un logo simple et un visuel très détaillé n’appellent pas nécessairement la même méthode.",
        "Vérifiez la taille et l’emplacement du marquage sur le vêtement porté. Un visuel trop grand ou placé trop bas peut nuire au confort et à la lisibilité.",
        "Demandez un échantillon ou validez un aperçu avant une production importante, et suivez les consignes de lavage pour prolonger la durée de vie du marquage.",
      ],
    },
  ],
  en: [
    {
      slug: "preparer-fichier-impression",
      category: "Print",
      title: "Preparing artwork for print",
      excerpt: "Essential checks for a crisp document that stays true to your design.",
      sections: [
        "Before sending a file, check its final dimensions and add the bleed requested by your printer. Bleed prevents a thin white edge from appearing after trimming.",
        "Keep text and important elements inside a safe margin. Embed fonts or convert text to outlines when required by your workflow.",
        "Check photographs at their final print size. An image that looks sharp on screen can become blurry when enlarged.",
        "Export a print-ready PDF and inspect it at high zoom before sending. If you are unsure about the settings, ask for a file check before production.",
      ],
    },
    {
      slug: "choisir-support-publicitaire",
      category: "Communication",
      title: "Choosing the right promotional material",
      excerpt: "Match format, material and message to the people you want to reach.",
      sections: [
        "Start with the goal: inform, introduce an offer, guide visitors or leave a lasting reminder. The right material follows from how it will be used.",
        "A flyer works well for short information distributed widely. A brochure can explain several services, while a poster needs to be understood in seconds.",
        "Think about where it will be seen: distance, viewing time, indoor or outdoor use, and frequency. These factors affect format, paper and finishing.",
        "Keep one main message, a clear hierarchy and a useful call to action. An effective piece does not try to say everything at once.",
      ],
    },
    {
      slug: "image-de-marque",
      category: "Brand identity",
      title: "Building a consistent brand identity",
      excerpt: "Simple principles to make your identity recognisable across every medium.",
      sections: [
        "A consistent identity relies on repeatable choices: logo, colours, typefaces, image style and tone of voice. Keep these rules easy to apply.",
        "Prepare logo variations for light and dark backgrounds, plus a compact version for small formats. Avoid changing proportions or colours from one item to the next.",
        "Set a short colour palette and a readable type hierarchy. Consistency does not mean every item looks identical, but they should feel like the same brand.",
        "Gather these rules in a practical guide and share it with everyone who creates your materials.",
      ],
    },
    {
      slug: "resolution-image-impression",
      category: "Print",
      title: "What image resolution makes a sharp print?",
      excerpt: "Understand DPI and check images at their actual print size.",
      sections: [
        "Useful resolution depends on viewing distance. For a hand-held document, around 300 DPI at final size is a helpful reference.",
        "A poster or large-format display viewed from farther away may need less. Always judge the file at its intended physical size.",
        "Artificially enlarging a small image does not restore missing detail. Find a higher-quality source or a vector version if the artwork needs substantial enlargement.",
        "Check pixel dimensions and preview the image at 100% before printing. Screenshots and social-media downloads are often heavily compressed.",
      ],
    },
    {
      slug: "fonds-perdus-marges-securite",
      category: "Artwork setup",
      title: "Bleed and safe margins: what is the difference?",
      excerpt: "Two simple guides that prevent white edges and text too close to trimming.",
      sections: [
        "Bleed extends colours and images beyond the final trim size. It allows for small cutting variations and prevents unwanted white edges.",
        "A safe margin does the opposite: it keeps text, logos and important details away from the trim edge.",
        "Exact values vary by product and print process. Follow the specifications for your order instead of relying on a universal measurement.",
        "Show trim guides in your design software and export the PDF with the requested bleed. Check that background artwork covers the entire bleed area.",
      ],
    },
    {
      slug: "cmjn-rvb-impression",
      category: "Colour",
      title: "CMYK or RGB: preparing print colours",
      excerpt: "Why screen colours can differ in print and how to plan for the change.",
      sections: [
        "Screens create colour with RGB light, while common printing uses CMYK inks. The two colour spaces cannot reproduce every colour identically.",
        "A bright blue or saturated orange on screen may look more muted on paper. The result also depends on the material, finish and printing equipment.",
        "Prepare your artwork using the colour profile recommended by your printer. Repeated conversions can change colours, so avoid unnecessary ones.",
        "For an important brand colour, request a proof on the intended material. It is the best way to approve the actual printed result.",
      ],
    },
    {
      slug: "choisir-papier-impression",
      category: "Materials",
      title: "How to choose paper for your print materials",
      excerpt: "Choose weight, texture and finish for the intended use—not by number alone.",
      sections: [
        "Paper weight indicates how heavy a sheet is, but does not fully describe its feel or stiffness. Paper type and finish matter too.",
        "A lightweight sheet may suit a flyer distributed in large quantities. A business card or cover usually benefits from a heavier, sturdier stock.",
        "Coated paper can enhance photographs and colours. Uncoated paper has a more natural feel and is often easier to write on.",
        "If you are unsure, compare physical samples and consider budget, expected lifespan and the impression you want to create.",
      ],
    },
    {
      slug: "concevoir-flyer-efficace",
      category: "Graphic design",
      title: "Designing a clear and effective flyer",
      excerpt: "Structure your message so readers understand it at a glance.",
      sections: [
        "Start with one clear promise or key piece of information. Readers should understand the subject before getting into the details.",
        "Organise the content into three levels: headline, useful information, then contact details or a call to action. Leave enough space around each block.",
        "Use strong contrast and text sizes suited to the reading distance. Limit typefaces and decorative effects.",
        "Before printing, check dates, prices, phone numbers, links and offer conditions. A second reader can often spot something you missed.",
      ],
    },
    {
      slug: "signaletique-lisible",
      category: "Signage",
      title: "Making signage easy to read from a distance",
      excerpt: "Use contrast, size and placement to guide people clearly.",
      sections: [
        "First decide how far away and from what angle the message will be read. Choose type size for the real location, not just the design screen.",
        "Use strong contrast between text and background. Avoid thin lettering on busy images, distracting reflections and too many secondary details.",
        "Put information in a useful order: name or destination, key direction, then details. People on the move need to grasp the main point quickly.",
        "Check visibility on site under real lighting and around nearby obstacles. A full-size preview or print test helps confirm the result.",
      ],
    },
    {
      slug: "textile-personnalise-durable",
      category: "Textiles",
      title: "Choosing custom clothing that lasts",
      excerpt: "Consider use, comfort and decoration method before placing an order.",
      sections: [
        "Choose clothing for its purpose: everyday teamwear, a one-off event, outdoor work or a uniform. Comfort and easy care matter as much as appearance.",
        "The decoration method depends on fabric, artwork, colours and order size. A simple logo and a highly detailed design may need different approaches.",
        "Check the scale and placement of the design on the garment when worn. An oversized or low-placed graphic can affect both comfort and readability.",
        "Request a sample or approve a proof before a large order, then follow care instructions to help the decoration last.",
      ],
    },
  ],
};

export function getInsights(locale: Locale): Insight[] {
  return insights[locale];
}

export function getInsight(locale: Locale, slug: string): Insight | undefined {
  return insights[locale].find((insight) => insight.slug === slug);
}

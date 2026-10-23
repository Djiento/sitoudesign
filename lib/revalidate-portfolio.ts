import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePortfolioPages() {
  revalidateTag("public-portfolio", { expire: 0 });

  for (const locale of ["fr", "en"]) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/realisations`);
  }

  revalidatePath("/[locale]/realisations/[slug]", "page");
}

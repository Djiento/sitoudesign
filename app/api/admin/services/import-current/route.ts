import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import content from "@/lib/starter-content.json";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const services = await prisma.$transaction(async (transaction) => {
      for (const [index, service] of content.services.entries()) {
        await transaction.service.upsert({
          where: { slug: service.slug },
          update: {},
          create: {
            ...service,
            coverImage: content.images[index],
            sortOrder: index,
            isActive: true,
          },
        });
      }
      return transaction.service.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    });

    revalidateTag("public-services", { expire: 0 });
    revalidatePath("/fr/services");
    revalidatePath("/en/services");
    return NextResponse.json({ services });
  } catch (error) {
    console.error("Admin services import:", error);
    return NextResponse.json({ error: "Impossible d’importer les services existants." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import content from "@/lib/starter-content.json";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await prisma.$transaction(async (transaction) => {
      for (const [index, solution] of content.solutions.entries()) {
        await transaction.businessSolution.upsert({
          where: { slug: solution.slug },
          update: {},
          create: {
            ...solution,
            coverImage: content.images[index],
            isActive: true,
            sortOrder: index,
          },
        });
      }
      await transaction.managedContentSection.upsert({
        where: { key: "business-solutions" },
        update: {},
        create: { key: "business-solutions" },
      });
    });

    revalidatePath("/fr/solutions-entreprises");
    revalidatePath("/en/solutions-entreprises");
    const solutions = await prisma.businessSolution.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ solutions });
  } catch (error) {
    console.error("Admin business solutions import:", error);
    return NextResponse.json({ error: "Impossible d’importer les solutions actuelles." }, { status: 500 });
  }
}

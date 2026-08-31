import { NextRequest, NextResponse } from "next/server";
import { getLocalUser } from "@/lib/local-user.server";
import { prisma } from "@/lib/db";

// GET - Fetch user's onboarding metadata
export async function GET() {
  try {
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse metadata, handle legacy users with no metadata field
    const metadata =
      typeof userData.metadata === "object" && userData.metadata !== null
        ? userData.metadata
        : {
            hasCompletedDashboardTour: false,
            hasCompletedAnalysisTour: false,
          };

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error("Error fetching onboarding status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update user's onboarding metadata
export async function PATCH(request: NextRequest) {
  try {
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { hasCompletedDashboardTour, hasCompletedAnalysisTour } = body;

    // Fetch current metadata
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Merge with existing metadata
    const currentMetadata =
      typeof userData.metadata === "object" && userData.metadata !== null
        ? userData.metadata
        : {
            hasCompletedDashboardTour: false,
            hasCompletedAnalysisTour: false,
          };

    const updatedMetadata = {
      ...currentMetadata,
      ...(hasCompletedDashboardTour !== undefined && {
        hasCompletedDashboardTour,
      }),
      ...(hasCompletedAnalysisTour !== undefined && {
        hasCompletedAnalysisTour,
      }),
    };

    // Update user metadata
    await prisma.user.update({
      where: { id: user.id },
      data: { metadata: updatedMetadata },
    });

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });
  } catch (error) {
    console.error("Error updating onboarding status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth";
import { runWatchCycle } from "@/lib/watch/runWatchCycle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWatchCycle();
    return NextResponse.json({
      checked: result.checked,
      tracked: result.tracked,
      hot: result.hot.map((a) => ({
        id: a.deal.id,
        title: a.deal.title,
        url: a.deal.url,
        categorySlug: a.deal.categorySlug,
        votesPos: a.deal.votesPos,
        deltaVotes: a.deltaVotes,
        windowMinutes: a.windowMinutes,
      })),
      alerted: result.alerted.map((a) => a.deal.id),
      skippedCooldown: result.skippedCooldown,
      config: result.config,
      ranAt: result.ranAt,
      backend: result.backend,
    });
  } catch (error) {
    console.error("[ozbargain-watcher] watch failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Watch cycle failed",
      },
      { status: 500 },
    );
  }
}

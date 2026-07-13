import { NextResponse } from "next/server";
import { pingStore } from "@/lib/store/snapshots";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await pingStore();
  return NextResponse.json({
    ok: store.ok,
    store: store.backend,
    time: new Date().toISOString(),
  });
}

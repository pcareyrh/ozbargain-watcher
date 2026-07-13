import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth";
import { validateConfigOverrides } from "@/lib/config";
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories";
import {
  clearConfigOverrides,
  getConfigOverrides,
  loadConfig,
  saveConfigOverrides,
} from "@/lib/store/snapshots";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await loadConfig();
  const overrides = await getConfigOverrides();
  return NextResponse.json({
    config,
    overrides,
    categories: OZBARGAIN_CATEGORIES,
  });
}

export async function PUT(request: Request) {
  if (!authorizeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateConfigOverrides(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const config = await saveConfigOverrides(validated.value);
  const overrides = await getConfigOverrides();
  return NextResponse.json({ config, overrides });
}

export async function DELETE(request: Request) {
  if (!authorizeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await clearConfigOverrides();
  return NextResponse.json({ config, overrides: null });
}

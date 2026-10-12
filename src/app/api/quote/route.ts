import { NextResponse } from "next/server";
import { getQuote } from "@/lib/store";
import type { RuleConfig } from "@/lib/pricing/types";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const model = String(body.model ?? ""); const variant = String(body.variant ?? "");
  const hours = Number(body.hours ?? 0);
  const overrides = (body.overrides ?? undefined) as Partial<RuleConfig> | undefined;
  if (!model || !variant) return NextResponse.json({ error: "model and variant required" }, { status: 400 });
  return NextResponse.json(await getQuote(model, variant, hours, 3, overrides));
}
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") ?? ""; const variant = searchParams.get("variant") ?? "";
  const hours = Number(searchParams.get("hours") ?? "0");
  if (!model || !variant) return NextResponse.json({ error: "model and variant required" }, { status: 400 });
  return NextResponse.json(await getQuote(model, variant, hours));
}

export const dynamic = "force-dynamic";

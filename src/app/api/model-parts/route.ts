import { NextResponse } from "next/server";
import { getModelParts, getManualRows, listModels } from "@/lib/store";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model");
  if (!model) return NextResponse.json({ models: await listModels() });
  const [variants, manualRows] = await Promise.all([getModelParts(model), getManualRows(model)]);
  return NextResponse.json({ model, variants, manualRows });
}

export const dynamic = "force-dynamic";

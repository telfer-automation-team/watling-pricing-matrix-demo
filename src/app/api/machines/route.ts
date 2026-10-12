import { NextResponse } from "next/server";
import { getMachineTree } from "@/lib/store";
export async function GET() {
  return NextResponse.json({ tree: await getMachineTree() });
}

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { parsePriceFile, parseSqtFile } from "@/lib/csv";
import { getDataStatus } from "@/lib/store";
import { ingestCopy } from "@/lib/ingest-copy";
import type { PartPrice, SqtLine } from "@/lib/pricing/types";

export const maxDuration = 300; // large uploads; Railway has no function timeout

export async function GET() {
  return NextResponse.json(await getDataStatus());
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const form = await request.formData();
  const priceFile = form.get("priceFile");
  const partsFile = form.get("partsFile");

  const report: { field: string; name: string; rows: number }[] = [];
  let prices: PartPrice[] | undefined;
  let sqt: SqtLine[] | undefined;

  try {
    if (priceFile instanceof File && priceFile.size > 0) {
      prices = parsePriceFile(await priceFile.text());
      if (prices.length === 0) throw new Error(`"${priceFile.name}" has no price rows — is it the Price file?`);
      report.push({ field: "Pricing", name: priceFile.name, rows: prices.length });
    }
    if (partsFile instanceof File && partsFile.size > 0) {
      sqt = parseSqtFile(await partsFile.text());
      if (sqt.length === 0) throw new Error(`"${partsFile.name}" has no parts rows — is it the Parts (SQT) file?`);
      report.push({ field: "Parts", name: partsFile.name, rows: sqt.length });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read file." }, { status: 400 });
  }

  if (!prices || !sqt) return NextResponse.json({ error: "Both files are required: the Pricing file and the Parts (SQT) file." }, { status: 400 });

  const source = report.map((r) => `${r.field}: ${r.name}`).join(" · ");
  try {
    await ingestCopy({ prices, sqt, source, user: admin.fullName });
    return NextResponse.json({ ok: true, report, status: await getDataStatus() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ingest failed." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

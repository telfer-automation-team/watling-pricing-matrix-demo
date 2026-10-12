"use client";
import { useEffect, useRef, useState } from "react";

type Report = { field: string; name: string; rows: number }[];
type Status = { priceRows: number; serviceRows: number; machineRows: number; lastUpload: { at: string; source: string } | null };

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [priceName, setPriceName] = useState("");
  const [partsName, setPartsName] = useState("");
  const priceRef = useRef<HTMLInputElement>(null);
  const partsRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/ingest", { cache: "no-store" }).then((r) => r.json()).then(setStatus); }, []);

  async function upload() {
    const price = priceRef.current?.files?.[0];
    const parts = partsRef.current?.files?.[0];
    if (!price || !parts) { setError("Both files are required — choose the Pricing file and the Parts (SQT) file."); return; }
    setError(""); setReport(null); setBusy(true);
    const fd = new FormData();
    fd.append("priceFile", price);
    fd.append("partsFile", parts);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok || data.error) { setError(data.error || `Upload failed (HTTP ${res.status})`); return; }
      setReport(data.report); setStatus(data.status);
      setPriceName(""); setPartsName("");
      if (priceRef.current) priceRef.current.value = "";
      if (partsRef.current) partsRef.current.value = "";
    } catch (e) {
      setError("Upload failed — " + (e instanceof Error ? e.message : "please try again."));
    } finally {
      setBusy(false);
    }
  }

  const ready = !!priceName && !!partsName;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Upload data</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">
        Upload both JCB files — the Pricing file and the Parts (SQT) export. Both are required.
        On success the live prices swap over in one go.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FileCard
          title="Pricing file"
          hint="JCB Price File — part number, cost &amp; list price"
          fileName={priceName}
          inputRef={priceRef}
          onPick={(n) => { setPriceName(n); setError(""); }}
        />
        <FileCard
          title="Parts file (SQT)"
          hint="JCB Service Quotation export — parts, qty &amp; labour"
          fileName={partsName}
          inputRef={partsRef}
          onPick={(n) => { setPartsName(n); setError(""); }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={upload} disabled={busy || !ready} className="btn-primary disabled:opacity-50">
          {busy ? "Uploading & rebuilding…" : "Upload & publish"}
        </button>
        {!ready && !busy && <span className="text-xs text-[var(--color-ink-3)]">Choose both files to continue.</span>}
        {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
      </div>

      {report && (
        <div className="card mt-4 border-[var(--color-ok)]/30 bg-[var(--color-ok)]/5 p-4 text-sm">
          {report.map((r, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span className="truncate"><b>{r.field}</b> · {r.name}</span>
              <span className="text-[var(--color-ok)]">{r.rows.toLocaleString()} rows</span>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-4 p-5">
        <div className="wordmark text-sm text-[var(--color-ink)]">Current live data</div>
        {status && status.priceRows + status.serviceRows > 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            {status.priceRows.toLocaleString()} prices · {status.machineRows.toLocaleString()} machines · {status.serviceRows.toLocaleString()} priced services
            {status.lastUpload && <span className="block text-[var(--color-ink-3)]">last upload {new Date(status.lastUpload.at).toLocaleString("en-GB")} · {status.lastUpload.source}</span>}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-ink-3)]">No data loaded yet. Upload both files to begin.</p>
        )}
      </div>
    </div>
  );
}

function FileCard({ title, hint, fileName, inputRef, onPick }: {
  title: string; hint: string; fileName: string;
  inputRef: React.RefObject<HTMLInputElement | null>; onPick: (name: string) => void;
}) {
  const chosen = !!fileName;
  return (
    <label className={`card flex cursor-pointer flex-col items-center justify-center p-6 text-center transition-colors hover:border-[var(--color-brand)] ${chosen ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)]" : "border-dashed"}`}>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => onPick(e.target.files?.[0]?.name ?? "")} />
      <div className="wordmark text-sm text-[var(--color-ink)]">{title}</div>
      {chosen ? (
        <div className="mt-2 text-sm font-medium text-[var(--color-brand-dark)]">✓ {fileName}</div>
      ) : (
        <>
          <div className="mt-1 text-xs text-[var(--color-ink-3)]">{hint}</div>
          <div className="mt-3 text-xs font-medium text-[var(--color-info)]">Click to choose a .csv file</div>
        </>
      )}
    </label>
  );
}

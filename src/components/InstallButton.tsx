"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;
  return (
    <button
      onClick={async () => { await deferred.prompt(); setDeferred(null); }}
      className="mb-2 w-full rounded-[10px] border border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 px-3 py-2 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/20"
    >
      ⬇ Install app
    </button>
  );
}

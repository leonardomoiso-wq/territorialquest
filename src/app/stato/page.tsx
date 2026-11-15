"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { keySource, projectRef, supabaseConfigured, supabaseUrl } from "@/utils/supabase/env";
import { Button, Label, Logo } from "@/ui/kit";

type Result = { label: string; file: string; ok: boolean | null; detail?: string };

/** Ogni controllo legge una tabella o una colonna introdotta da una migrazione. */
const CHECKS: { label: string; file: string; table: string; select: string }[] = [
  { label: "Campagne, team, aree, rilievi", file: "20261114000000_init.sql", table: "campaigns", select: "id" },
  { label: "Iscrizioni e ruoli", file: "20261114000000_init.sql", table: "memberships", select: "id, role" },
  { label: "Missioni e messaggi", file: "20261114000000_init.sql", table: "announcements", select: "id" },
  { label: "Sfondi della mappa", file: "20261115000000_model_and_forms.sql", table: "campaigns", select: "basemap, overlay" },
  { label: "Modello 3D delle aree", file: "20261115000000_model_and_forms.sql", table: "areas", select: "environment, terrain" },
  { label: "Forme di raccolta", file: "20261115000000_model_and_forms.sql", table: "observations", select: "form, lens, path, data" },
  { label: "Uscite a piedi", file: "20261115000000_model_and_forms.sql", table: "walks", select: "id" },
];

export default function Stato() {
  const [results, setResults] = useState<Result[]>([]);
  const [auth, setAuth] = useState<string>("…");
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const db = createClient();
    let alive = true;
    (async () => {
      const out: Result[] = [];
      for (const c of CHECKS) {
        const { error } = await db.from(c.table).select(c.select).limit(1);
        out.push({ label: c.label, file: c.file, ok: !error, detail: error?.message });
      }
      const { error: bucket } = await db.storage.from("media").list("", { limit: 1 });
      out.push({ label: "Spazio per le foto", file: "20261114000100_platform.sql", ok: !bucket, detail: bucket?.message });
      const { data } = await db.auth.getUser();
      if (alive) { setResults(out); setAuth(data.user ? `accesso effettuato come ${data.user.email}` : "nessun accesso effettuato"); }
    })();
    return () => { alive = false; };
  }, [round]);

  const missing = [...new Set(results.filter((r) => r.ok === false).map((r) => r.file))].sort();

  return (
    <main className="on-paper min-h-dvh px-5 py-6 sm:px-8">
      <Link href="/"><Logo /></Link>
      <div className="mx-auto mt-14 max-w-2xl">
        <Label>Diagnosi</Label>
        <h1 className="display mt-2 text-[44px]">Stato del collegamento</h1>

        <dl className="surface mt-8 divide-y divide-line rounded-card border hairline text-[15px]">
          <div className="flex justify-between gap-4 p-4"><dt className="soft">Progetto Supabase</dt><dd className="num text-right">{projectRef || "non configurato"}</dd></div>
          <div className="flex justify-between gap-4 p-4"><dt className="soft">Indirizzo</dt><dd className="num truncate text-right">{supabaseUrl || "—"}</dd></div>
          <div className="flex justify-between gap-4 p-4"><dt className="soft">Chiave pubblica da</dt><dd className="num text-right">{keySource}</dd></div>
          <div className="flex justify-between gap-4 p-4"><dt className="soft">Sessione</dt><dd className="text-right">{auth}</dd></div>
        </dl>

        <ul className="mt-6 space-y-2">
          {results.map((r) => (
            <li key={r.label} className="surface flex items-start gap-3 rounded-2xl border hairline p-4">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: r.ok ? "var(--color-leaf)" : "var(--color-alert)" }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2"><span>{r.label}</span><span className="label soft">{r.file}</span></div>
                {!r.ok && r.detail && <p className="soft mt-1 text-sm">{r.detail}</p>}
              </div>
            </li>
          ))}
        </ul>

        {results.length > 0 && (missing.length === 0
          ? <p className="mt-6 rounded-2xl bg-leaf/10 p-4 text-[15px]">Tutto pronto: il database collegato ha tutte le tabelle che servono.</p>
          : (
            <div className="mt-6 rounded-2xl bg-alert/10 p-4 text-[15px]">
              <p>Nel progetto <b className="num">{projectRef}</b>, da Supabase → SQL Editor, esegui in quest&apos;ordine:</p>
              <ol className="num mt-2 list-decimal pl-6">{missing.map((f) => <li key={f}>{f}</li>)}</ol>
              <p className="soft mt-3 text-sm">Se il progetto non è quello giusto, correggi le variabili NEXT_PUBLIC_SUPABASE_URL e la chiave pubblica su Vercel e ripubblica.</p>
            </div>
          ))}
        <Button variant="outline" className="mt-6" onClick={() => setRound(round + 1)}>Ricontrolla</Button>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { joinCampaign } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import Topo from "@/ui/Topo";
import { Button, Label, Logo, Notice } from "@/ui/kit";

function Join() {
  const router = useRouter();
  const [code, setCode] = useState((useSearchParams().get("codice") ?? "").toUpperCase());
  const { busy, error, run } = useAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const id = await joinCampaign(code);
      router.push(`/campo/${id}`);
    });
  };

  return (
    <main className="on-ink relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden p-5 sm:p-7">
      <Topo seed={5.2} cx={0.95} cy={0.85} n={15} className="pointer-events-none absolute inset-0 size-full" opacity={0.13} />
      <Link href="/" className="relative"><Logo /></Link>
      <form onSubmit={submit} className="relative mx-auto w-full max-w-md self-center pb-16 text-center">
        <Label>Codice campagna</Label>
        <h1 className="serif mt-3 animate-rise text-[64px]">Dove si esplora?</h1>
        <input
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          aria-label="Codice campagna" placeholder="······" autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false}
          className="num mt-10 h-20 w-full rounded-panel border hairline bg-transparent text-center text-[40px] tracking-[0.3em] uppercase outline-none transition placeholder:text-white/20 focus:border-glow"
        />
        <p className="soft mt-3 text-sm">Te lo dà chi coordina l&apos;attività.</p>
        {error && <div className="mt-5 text-left"><Notice tone="error">{error}</Notice></div>}
        <Button type="submit" size="lg" variant="glow" className="mt-8 w-full" disabled={busy || code.length < 4}>
          {busy ? "Entro…" : "Entra nella campagna"}
        </Button>
        <Link href="/studio" className="soft mt-6 inline-block text-sm underline-offset-4 hover:underline">
          Le mie campagne
        </Link>
      </form>
    </main>
  );
}

export default function Entra() {
  return (
    <Suspense>
      <Join />
    </Suspense>
  );
}

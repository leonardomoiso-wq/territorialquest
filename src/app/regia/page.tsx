"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { claimOrganizer, isOrganizer, signIn, signOut, signUp, useSession } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import Topo from "@/ui/Topo";
import { Button, Field, Label, Logo, Notice, Spinner } from "@/ui/kit";

/**
 * Accesso di regia: separato da quello dei giocatori.
 * Si entra con email e password personali; per diventare regia serve il codice
 * che il proprietario del progetto ha impostato nel database.
 */
export default function Regia() {
  const { user, name } = useSession();
  const [organizer, setOrganizer] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!user) { setTimeout(() => setOrganizer(null), 0); return; }
    isOrganizer().then(setOrganizer, () => setOrganizer(false));
  }, [user]);

  // la regia va direttamente allo Studio
  useEffect(() => { if (organizer) window.location.replace("/studio"); }, [organizer]);

  const enter = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "in") return signIn(email.trim(), password);
      const confirmEmail = await signUp(email.trim(), password, displayName.trim());
      if (confirmEmail) return setSent(true);
      if (!(await claimOrganizer(code))) throw new Error("Profilo creato, ma il codice di regia non è corretto. Riprova qui sotto.");
      setOrganizer(true);
    });
  };
  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!(await claimOrganizer(code))) throw new Error("Codice di regia non corretto. Dopo 5 tentativi si blocca per 15 minuti.");
      setOrganizer(true);
    });
  };

  return (
    <main className="on-ink relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden p-5 sm:p-7">
      <Topo seed={1.2} cx={0.9} cy={0.95} n={16} className="pointer-events-none absolute inset-0 size-full" opacity={0.15} />
      <div className="relative flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <span className="cartello text-glow">Regia</span>
      </div>

      <div className="relative mx-auto w-full max-w-sm self-center py-12">
        {user === undefined || (user && organizer === null) || organizer ? (
          <Spinner label="Apro la regia" />
        ) : user ? (
          <>
            <h1 className="serif animate-rise text-[56px] leading-none">Codice di regia</h1>
            <p className="soft mt-4">Sei entrato come <b className="text-paper">{name}</b>, ma questo profilo non è ancora di regia. Inserisci il codice che ti ha dato chi gestisce il progetto.</p>
            <form onSubmit={claim} className="mt-8 space-y-3">
              <Field label="Codice di regia" type="password" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" autoFocus />
              {error && <Notice tone="error">{error}</Notice>}
              <Button type="submit" size="lg" variant="glow" className="w-full" disabled={busy}>{busy ? "Verifico…" : "Entra in regia"}</Button>
            </form>
            <div className="mt-6 flex flex-col items-start gap-2 text-sm">
              <button type="button" className="soft underline-offset-4 hover:underline" onClick={signOut}>Esci e usa un altro profilo</button>
              <Link href="/studio" className="soft underline-offset-4 hover:underline">Vai alle campagne da giocatore</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="serif animate-rise text-[64px] leading-none">{mode === "in" ? "Regia." : "Nuova regia."}</h1>
            <p className="soft mt-4">
              {mode === "in" ? "Accesso riservato a chi crea e coordina le campagne. I tutor entrano come giocatori: li nomina la regia dentro la campagna." : "Crea il profilo di regia con la tua password. Ti serve il codice di regia del progetto."}
            </p>
            {sent ? (
              <div className="mt-8"><Notice tone="ok">Ti abbiamo inviato un link di conferma a {email}. Aprilo, poi accedi da questa pagina e inserisci il codice di regia.</Notice></div>
            ) : (
              <form onSubmit={enter} className="mt-8 space-y-3">
                {mode === "up" && <Field label="Nome visibile" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} autoComplete="name" />}
                <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
                <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10}
                  autoComplete={mode === "in" ? "current-password" : "new-password"} hint={mode === "up" ? "Scegli tu la password: almeno 10 caratteri." : undefined} />
                {mode === "up" && <Field label="Codice di regia" type="password" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />}
                {error && <Notice tone="error">{error}</Notice>}
                <Button type="submit" size="lg" variant="glow" className="mt-2 w-full" disabled={busy}>
                  {busy ? "Un momento…" : mode === "in" ? "Entra in regia" : "Crea il profilo di regia"}
                </Button>
              </form>
            )}
            <div className="mt-6 flex flex-col items-start gap-2 text-sm">
              <button type="button" className="soft underline-offset-4 hover:underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }}>
                {mode === "in" ? "Primo accesso? Crea il profilo di regia" : "Hai già il profilo di regia? Accedi"}
              </button>
              {mode === "in" && <Link href="/accedi?recupero=1" className="soft underline-offset-4 hover:underline">Password dimenticata?</Link>}
              <Link href="/accedi" className="soft underline-offset-4 hover:underline">Partecipi a una campagna? Accesso giocatori</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

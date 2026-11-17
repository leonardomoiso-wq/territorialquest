"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { recoveryQuestion, resetPassword, setRecovery, signIn, signUp, useSession } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Button, Field, Label, Logo, Notice } from "@/ui/kit";
import { SecretFields, type Secret } from "@/ui/Recovery";

type Mode = "in" | "up" | "lost";

function Form() {
  const next = useSearchParams().get("next") || "/studio";
  const { user } = useSession();
  const [mode, setMode] = useState<Mode>("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState<Secret>({ question: "", answer: "" });
  const [sent, setSent] = useState(false);
  // recupero
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [fresh, setFresh] = useState("");
  const [again, setAgain] = useState("");
  const { busy, error, run, setError } = useAction();

  // Navigazione completa: il router potrebbe ricordare il reindirizzamento all'accesso
  // di quando la sessione non c'era ancora.
  const leave = useCallback(() => window.location.replace(next.startsWith("/") ? next : "/studio"), [next]);

  useEffect(() => {
    // dopo la registrazione la domanda segreta va salvata prima di lasciare la pagina
    if (user && mode !== "up") leave();
  }, [user, mode, leave]);

  const go = (m: Mode) => { setMode(m); setSent(false); setQuestion(null); setError(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "in") return signIn(email, password);
      if (mode === "up") {
        const confirmEmail = await signUp(email, password, name.trim());
        if (confirmEmail) return setSent(true);
        // se non riesce, il promemoria in Studio la richiede al primo accesso
        await setRecovery(secret.question.trim(), secret.answer).catch(() => undefined);
        leave();
        return;
      }
      // recupero: prima la domanda, poi la risposta e la nuova password
      if (question === null) {
        const q = await recoveryQuestion(email.trim());
        if (!q) throw new Error("Per questa email non è impostata una domanda segreta. Chiedi a chi coordina la campagna.");
        return setQuestion(q);
      }
      if (fresh !== again) throw new Error("Le due password non coincidono.");
      const ok = await resetPassword(email.trim(), answer, fresh);
      if (!ok) throw new Error("Risposta non corretta. Dopo 5 tentativi il recupero si blocca per 15 minuti.");
      await signIn(email.trim(), fresh);
    });
  };

  const title = { in: "Bentornati.", up: "Benvenuti.", lost: "Nessun problema." }[mode];
  const lead = {
    in: "Accedi per riprendere l'esplorazione.",
    up: "Crea il tuo profilo: ti basta un'email.",
    lost: question ? "Rispondi alla tua domanda segreta e scegli una nuova password." : "Scrivi l'email del tuo profilo: ti chiediamo la domanda segreta.",
  }[mode];

  return (
    <main className="on-ink grid min-h-dvh grid-rows-[auto_1fr] p-5 sm:p-7">
      <Link href="/"><Logo /></Link>
      <div className="mx-auto w-full max-w-sm self-center py-12">
        <h1 className="serif animate-rise text-[64px]" key={mode}>{title}</h1>
        <p className="soft mt-3 animate-rise [animation-delay:60ms]">{lead}</p>

        {sent ? (
          <div className="mt-8"><Notice tone="ok">Ti abbiamo inviato un link di conferma a {email}. Aprilo e poi accedi: la domanda segreta la imposterai al primo accesso.</Notice></div>
        ) : (
          <form onSubmit={submit} className="mt-8 animate-rise space-y-3 [animation-delay:120ms]">
            {mode === "up" && <Field label="Nome visibile al team" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="nickname" maxLength={40} />}
            <Field label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (mode === "lost") setQuestion(null); }} required autoComplete="email" />
            {mode !== "lost" && (
              <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                autoComplete={mode === "in" ? "current-password" : "new-password"} hint={mode === "up" ? "Almeno 8 caratteri." : undefined} />
            )}
            {mode === "up" && <div className="pt-2"><SecretFields value={secret} onChange={setSecret} /></div>}
            {mode === "lost" && question && (
              <>
                <div className="rounded-2xl border hairline p-4">
                  <Label>La tua domanda</Label>
                  <p className="serif mt-1 text-[24px] leading-tight italic">{question}</p>
                </div>
                <Field label="Risposta" value={answer} onChange={(e) => setAnswer(e.target.value)} required autoComplete="off" autoFocus />
                <Field label="Nuova password" type="password" value={fresh} onChange={(e) => setFresh(e.target.value)} required minLength={8} autoComplete="new-password" hint="Almeno 8 caratteri." />
                <Field label="Ripeti la nuova password" type="password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} autoComplete="new-password" />
              </>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
              {busy ? "Un momento…" : mode === "in" ? "Accedi" : mode === "up" ? "Crea il profilo" : question ? "Cambia la password ed entra" : "Continua"}
            </Button>
          </form>
        )}

        <div className="mt-6 flex flex-col items-start gap-2 text-sm">
          {mode === "in" && <button type="button" className="soft underline-offset-4 hover:underline" onClick={() => go("lost")}>Password dimenticata?</button>}
          <button type="button" className="soft underline-offset-4 hover:underline" onClick={() => go(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Non hai un profilo? Crealo" : "Torna all'accesso"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function Accedi() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

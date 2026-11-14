"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn, signUp, useSession } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Button, Field, Logo, Notice } from "@/ui/kit";
import { supabaseConfigured } from "@/utils/supabase/env";

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/studio";
  const { user } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "in") await signIn(email, password);
      else if (await signUp(email, password, name.trim())) setSent(true);
    });
  };

  return (
    <main className="on-ink grid min-h-dvh grid-rows-[auto_1fr] p-5 sm:p-7">
      <Link href="/"><Logo /></Link>
      <div className="mx-auto w-full max-w-sm self-center pb-16">
        <h1 className="serif animate-rise text-[64px]">{mode === "in" ? "Bentornati." : "Benvenuti."}</h1>
        <p className="soft mt-3 animate-rise [animation-delay:60ms]">
          {mode === "in" ? "Accedi per riprendere l'esplorazione." : "Crea il tuo profilo: ti basta un'email."}
        </p>

        {!supabaseConfigured && (
          <div className="mt-6"><Notice tone="error">Supabase non è configurato: imposta le variabili in .env.local.</Notice></div>
        )}

        {sent ? (
          <div className="mt-8"><Notice tone="ok">Ti abbiamo inviato un link di conferma a {email}. Aprilo e poi accedi.</Notice></div>
        ) : (
          <form onSubmit={submit} className="mt-8 animate-rise space-y-3 [animation-delay:120ms]">
            {mode === "up" && (
              <Field label="Nome visibile al team" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="nickname" maxLength={40} />
            )}
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Field
              label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              autoComplete={mode === "in" ? "current-password" : "new-password"} hint={mode === "up" ? "Almeno 8 caratteri." : undefined}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
              {busy ? "Un momento…" : mode === "in" ? "Accedi" : "Crea il profilo"}
            </Button>
          </form>
        )}

        <button
          type="button" className="soft mt-6 text-sm underline-offset-4 hover:underline"
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }}
        >
          {mode === "in" ? "Non hai un profilo? Crealo" : "Hai già un profilo? Accedi"}
        </button>
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

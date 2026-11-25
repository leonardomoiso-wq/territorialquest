"use client";

export type LngLat = [number, number];

/** Spiega in parole semplici perché la posizione non arriva. */
export function geoMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) return "La posizione funziona solo su un indirizzo sicuro (https).";
  if (typeof navigator !== "undefined" && !navigator.geolocation) return "Questo browser non dà la posizione.";
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) return "Posizione negata: riattivala dal lucchetto accanto all'indirizzo, poi riprova.";
  if (code === 2) return "Il dispositivo non sa dove si trova. Su computer attiva la localizzazione (Mac: Impostazioni, Privacy, Localizzazione; Windows: Impostazioni, Privacy, Posizione) e collegati al Wi-Fi.";
  if (code === 3) return "La posizione tarda ad arrivare: riprova all'aperto o vicino al Wi-Fi.";
  return "Posizione non disponibile.";
}

const once = (opts: PositionOptions) => new Promise<GeolocationPosition>((ok, ko) => navigator.geolocation.getCurrentPosition(ok, ko, opts));

/**
 * Chiede la posizione una volta. Prima con il GPS (telefono), poi con la stima
 * da Wi-Fi e rete (computer senza GPS): i computer spesso non rispondono alla prima.
 */
export async function locateOnce(): Promise<{ at: LngLat; accuracy: number }> {
  if (!window.isSecureContext || !navigator.geolocation) throw new Error(geoMessage(undefined));
  const pick = (g: GeolocationPosition) => ({ at: [g.coords.longitude, g.coords.latitude] as LngLat, accuracy: g.coords.accuracy ?? 0 });
  try {
    return pick(await once({ enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }));
  } catch (e) {
    if ((e as GeolocationPositionError).code === 1) throw new Error(geoMessage(e));
    try { return pick(await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })); } catch (e2) { throw new Error(geoMessage(e2)); }
  }
}

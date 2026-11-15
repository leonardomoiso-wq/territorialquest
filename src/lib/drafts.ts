"use client";

/**
 * Scatti rapidi: foto prese camminando e completate dopo.
 * Restano sul dispositivo (IndexedDB) finché non vengono inviate.
 */
export interface Draft {
  id: string;
  campaign_id: string;
  blob: Blob;
  name: string;
  lng: number;
  lat: number;
  created_at: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("territorial-quest", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("drafts", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("drafts", mode).objectStore("drafts"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts(campaignId: string): Promise<Draft[]> {
  try {
    const all = await run<Draft[]>("readonly", (s) => s.getAll());
    return all.filter((d) => d.campaign_id === campaignId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

export async function addDraft(campaignId: string, file: File, at: [number, number]): Promise<Draft> {
  const draft: Draft = {
    id: crypto.randomUUID(), campaign_id: campaignId, blob: file, name: file.name || "foto.jpg",
    lng: at[0], lat: at[1], created_at: new Date().toISOString(),
  };
  await run("readwrite", (s) => s.put(draft));
  return draft;
}

export const removeDraft = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined, () => undefined);

// On-phone signal store (plan §9.1–9.2): home coordinates, home enter/exit times and rounded
// place cells live ONLY in this file on the phone. Only the two daily numbers derived from
// them (hours_away_from_home, places_visited) are ever uploaded (see daily.ts).
import { File, Paths } from 'expo-file-system';

export interface HomeEvent {
  at: number; // epoch ms
  type: 'enter' | 'exit';
}

export interface SignalStore {
  home: { lat: number; lon: number } | null;
  homeEvents: HomeEvent[];
  /** Rounded place cells seen per local day (YYYY-MM-DD → cell keys). */
  cells: Record<string, string[]>;
  /** Last day (YYYY-MM-DD) whose row was uploaded. */
  lastUploadDay: string | null;
}

const EMPTY: SignalStore = { home: null, homeEvents: [], cells: {}, lastUploadDay: null };
const KEEP_DAYS = 4;

const file = () => new File(Paths.document, 'signals.json');

async function read(): Promise<SignalStore> {
  try {
    const f = file();
    if (!f.exists) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(await f.text()) as Partial<SignalStore>) };
  } catch {
    return { ...EMPTY };
  }
}

async function write(store: SignalStore): Promise<void> {
  const f = file();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(store));
}

// Background tasks and the app can touch the store at the same time; run updates one by one.
let queue: Promise<unknown> = Promise.resolve();

export function updateStore(change: (s: SignalStore) => SignalStore | void): Promise<SignalStore> {
  const next = queue.then(async () => {
    const current = await read();
    const updated = change(current) ?? current;
    await write(prune(updated));
    return updated;
  });
  queue = next.catch(() => undefined);
  return next;
}

export function readStore(): Promise<SignalStore> {
  return queue.then(read, read);
}

/** Forget everything location-related (consent turned off, sign-out, account deleted). */
export function clearLocationData(): Promise<SignalStore> {
  return updateStore((s) => ({ ...s, home: null, homeEvents: [], cells: {} }));
}

export function clearAll(): Promise<SignalStore> {
  return updateStore(() => ({ ...EMPTY }));
}

function prune(s: SignalStore): SignalStore {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);
  // Keep the last event before the cutoff too: it tells us whether the day started at home.
  const before = s.homeEvents.filter((e) => e.at < cutoff);
  const recent = s.homeEvents.filter((e) => e.at >= cutoff);
  const cells = Object.fromEntries(Object.entries(s.cells).filter(([day]) => day >= cutoffDay));
  return { ...s, homeEvents: [...before.slice(-1), ...recent], cells };
}

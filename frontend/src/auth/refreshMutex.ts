let inflight: Promise<string> | null = null;

export function runSingleFlight(fn: () => Promise<string>) {
  if (!inflight) {
    inflight = fn().finally(() => (inflight = null));
  }
  return inflight;
}

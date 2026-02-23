const KEY = "hideAdultContent";
const DEFAULT_HIDE = true;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function readBool(raw: string | null, fallback: boolean) {
  if (raw === null) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export function getHideAdultContent(): boolean {
  return readBool(window.localStorage.getItem(KEY), DEFAULT_HIDE);
}

export function setHideAdultContent(value: boolean): void {
  window.localStorage.setItem(KEY, value ? "true" : "false");
  emit();
}

window.addEventListener("storage", (event) => {
  if (event.key === KEY) emit();
});

export function subscribeHideAdultContent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}


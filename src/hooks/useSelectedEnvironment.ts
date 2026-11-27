import { useEffect, useState } from "react";

const KEY = "nexti-admin-environment";
const EVENT = "nexti-admin-environment-change";

/** Ambiente escolhido pelo Master no seletor do topo ("all" = todos). Só preferência de tela. */
export function useSelectedEnvironment() {
  const [value, setValue] = useState<string>(() => localStorage.getItem(KEY) || "all");
  useEffect(() => {
    const sync = () => setValue(localStorage.getItem(KEY) || "all");
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const set = (v: string) => { localStorage.setItem(KEY, v); window.dispatchEvent(new Event(EVENT)); };
  return [value, set] as const;
}

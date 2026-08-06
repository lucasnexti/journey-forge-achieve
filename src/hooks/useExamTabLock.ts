import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bloqueio entre abas: garante que a mesma prova (usuário + curso) esteja
 * ativa em apenas uma aba por vez, evitando tentativas duplicadas.
 *
 * Funciona via localStorage + heartbeat: a aba dona renova o "lock" a cada
 * HEARTBEAT_MS. Se a aba dona for fechada/travar, o lock expira em STALE_MS
 * e outra aba pode assumir.
 */

const HEARTBEAT_MS = 3000;
const STALE_MS = 10000;

interface LockValue {
  tabId: string;
  ts: number;
}

const readLock = (key: string): LockValue | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as LockValue;
    if (!v?.tabId || !v?.ts) return null;
    return v;
  } catch {
    return null;
  }
};

const isStale = (v: LockValue | null) => !v || Date.now() - v.ts > STALE_MS;

export const useExamTabLock = (lockKey: string | null) => {
  const tabIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );
  const ownedRef = useRef(false);
  const [blockedByOtherTab, setBlockedByOtherTab] = useState(false);
  /** segundos até o lock da outra aba expirar (null quando não bloqueado) */
  const [lockSecondsLeft, setLockSecondsLeft] = useState<number | null>(null);


  const release = useCallback(() => {
    if (!lockKey) return;
    const current = readLock(lockKey);
    if (!current || current.tabId === tabIdRef.current) {
      try { localStorage.removeItem(lockKey); } catch { /* noop */ }
    }
    ownedRef.current = false;
  }, [lockKey]);

  /** Tenta assumir o lock. Retorna false se outra aba já está com a prova aberta. */
  const acquire = useCallback((): boolean => {
    if (!lockKey) return true;
    const current = readLock(lockKey);
    if (current && current.tabId !== tabIdRef.current && !isStale(current)) {
      setBlockedByOtherTab(true);
      return false;
    }
    try {
      localStorage.setItem(lockKey, JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }));
    } catch {
      return true; // storage indisponível — não bloqueia a prova
    }
    ownedRef.current = true;
    setBlockedByOtherTab(false);
    return true;
  }, [lockKey]);

  /** Verifica se outra aba detém o lock (sem tentar assumir). */
  const isHeldByOtherTab = useCallback((): boolean => {
    if (!lockKey) return false;
    const current = readLock(lockKey);
    return !!current && current.tabId !== tabIdRef.current && !isStale(current);
  }, [lockKey]);

  // Heartbeat enquanto esta aba for a dona
  useEffect(() => {
    if (!lockKey) return;
    const beat = () => {
      if (!ownedRef.current) return;
      const current = readLock(lockKey);
      if (current && current.tabId !== tabIdRef.current && !isStale(current)) {
        // outra aba assumiu (nosso lock expirou enquanto a aba estava suspensa)
        ownedRef.current = false;
        setBlockedByOtherTab(true);
        return;
      }
      try {
        localStorage.setItem(lockKey, JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }));
      } catch { /* noop */ }
    };
    const t = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    const onUnload = () => { if (ownedRef.current) release(); };
    window.addEventListener("pagehide", onUnload);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [lockKey, release]);

  // Libera o lock ao desmontar
  useEffect(() => () => { if (ownedRef.current) release(); }, [release]);

  // Contagem regressiva enquanto esta aba está bloqueada por outra
  useEffect(() => {
    if (!lockKey || !blockedByOtherTab) {
      setLockSecondsLeft(null);
      return;
    }
    const tick = () => {
      const current = readLock(lockKey);
      if (!current || current.tabId === tabIdRef.current) {
        setLockSecondsLeft(0);
        return;
      }
      const left = Math.max(0, Math.ceil((STALE_MS - (Date.now() - current.ts)) / 1000));
      setLockSecondsLeft(left);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockKey, blockedByOtherTab]);

  return {
    acquire,
    release,
    isHeldByOtherTab,
    blockedByOtherTab,
    setBlockedByOtherTab,
    lockSecondsLeft,
    isOwner: () => ownedRef.current,
  };
};

export default useExamTabLock;


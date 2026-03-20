import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, TrendingUp, Trophy, Flame, Star } from "lucide-react";
import confetti from "canvas-confetti";

export interface Achievement {
  id: string;
  type: "coins" | "xp" | "level_up" | "track_complete" | "streak" | "badge";
  title: string;
  description: string;
  value?: number;
}

// Global event emitter for achievements
const listeners = new Set<(a: Achievement) => void>();

export function triggerAchievement(achievement: Omit<Achievement, "id">) {
  const a = { ...achievement, id: crypto.randomUUID() };
  listeners.forEach((fn) => fn(a));
}

const iconMap = {
  coins: Coins,
  xp: TrendingUp,
  level_up: Star,
  track_complete: Trophy,
  streak: Flame,
  badge: Star,
};

const colorMap = {
  coins: "text-yellow-500",
  xp: "text-primary",
  level_up: "text-purple-500",
  track_complete: "text-success",
  streak: "text-orange-500",
  badge: "text-warning",
};

const bgMap = {
  coins: "from-yellow-500/20 to-yellow-600/5",
  xp: "from-primary/20 to-primary/5",
  level_up: "from-purple-500/20 to-purple-600/5",
  track_complete: "from-green-500/20 to-green-600/5",
  streak: "from-orange-500/20 to-orange-600/5",
  badge: "from-yellow-500/20 to-yellow-600/5",
};

export function AchievementPopup() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);

  const showNext = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) {
        setCurrent(null);
        return q;
      }
      const [next, ...rest] = q;
      setCurrent(next);
      return rest;
    });
  }, []);

  useEffect(() => {
    const handler = (a: Achievement) => {
      setQueue((q) => [...q, a]);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      showNext();
    }
  }, [queue, current, showNext]);

  useEffect(() => {
    if (!current) return;

    // Fire confetti for big achievements
    if (["level_up", "track_complete", "badge"].includes(current.type)) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.3 },
        colors: ["#FF6B1A", "#FFB347", "#FF8C42", "#FFA500"],
      });
    } else if (current.type === "coins") {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.4 },
        colors: ["#FFD700", "#FFA500", "#FF8C00"],
        gravity: 1.2,
      });
    }

    const timer = setTimeout(() => {
      setCurrent(null);
      setTimeout(showNext, 300);
    }, 3500);

    return () => clearTimeout(timer);
  }, [current, showNext]);

  const Icon = current ? iconMap[current.type] : Coins;
  const color = current ? colorMap[current.type] : "";
  const bg = current ? bgMap[current.type] : "";

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -60, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          <div className={`flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-r ${bg} backdrop-blur-xl px-5 py-3.5 shadow-xl shadow-black/10`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-card ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{current.title}</p>
              <p className="text-xs text-muted-foreground">{current.description}</p>
            </div>
            {current.value !== undefined && (
              <span className={`text-lg font-display font-extrabold ${color} tabular-nums ml-2`}>
                +{current.value}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

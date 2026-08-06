import { useRef, useState, useEffect, useCallback } from "react";
import Player from "@vimeo/player";
import { Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack, RotateCcw } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  onComplete: (watchedSeconds: number) => void;
  onProgress?: (watchedSeconds: number) => void;
  lessonTitle: string;
  onNext?: () => void;
  onPrev?: () => void;
  initialWatchedSeconds?: number;
  lessonDuration?: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PROGRESS_SAVE_INTERVAL = 15;

const isVimeoUrl = (url: string) =>
  url.includes("vimeo.com") || url.includes("player.vimeo.com");

const getVimeoEmbedUrl = (url: string) => {
  if (url.includes("player.vimeo.com/video/")) return url;
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (match) {
    const videoId = match[1];
    const hash = match[2];
    return hash
      ? `https://player.vimeo.com/video/${videoId}?h=${hash}`
      : `https://player.vimeo.com/video/${videoId}`;
  }
  return url;
};

const VideoPlayer = ({ videoUrl, onComplete, onProgress, lessonTitle, onNext, onPrev, initialWatchedSeconds = 0, lessonDuration = 0 }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialWatchedSeconds);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const vimeo = isVimeoUrl(videoUrl);
  const vimeoPlayerRef = useRef<Player | null>(null);
  const lastSavedRef = useRef(0);
  const completedRef = useRef(false);
  const currentTimeRef = useRef(initialWatchedSeconds);
  const lastRenderedSecondRef = useRef(Math.floor(initialWatchedSeconds));

  // Keep callbacks in refs so the Vimeo player is never re-created on parent re-render
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onProgressRef.current = onProgress;

  // Freeze the resume position per video so progress saves don't restart the player
  const resumeRef = useRef({ url: videoUrl, seconds: initialWatchedSeconds });
  if (resumeRef.current.url !== videoUrl) {
    resumeRef.current = { url: videoUrl, seconds: initialWatchedSeconds };
  }
  const resumeSeconds = resumeRef.current.seconds;

  // Only push state (re-render) when the visible second actually changes
  const syncCurrentTime = useCallback((time: number) => {
    currentTimeRef.current = time;
    const second = Math.floor(time);
    if (second !== lastRenderedSecondRef.current) {
      lastRenderedSecondRef.current = second;
      setCurrentTime(time);
    }
  }, []);

  const persistProgress = useCallback((time?: number) => {
    const safeTime = Math.max(0, Math.round(time ?? currentTimeRef.current));
    if (safeTime > 0) {
      lastSavedRef.current = safeTime;
      onProgressRef.current?.(safeTime);
    }
  }, []);

  useEffect(() => {
    setPlaying(false);
    currentTimeRef.current = resumeSeconds;
    lastRenderedSecondRef.current = Math.floor(resumeSeconds);
    setCurrentTime(resumeSeconds);
    setCompleted(false);
    completedRef.current = false;
    setSpeed(1);
    lastSavedRef.current = 0;
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, [videoUrl, resumeSeconds]);

  const saveProgressIfNeeded = useCallback((time: number) => {
    if (time - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
      persistProgress(time);
    }
  }, [persistProgress]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistProgress();
    };
    const handlePageHide = () => persistProgress();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      persistProgress();
    };
  }, [persistProgress, videoUrl]);


  useEffect(() => {
    if (!vimeo || !iframeRef.current) return;
    const player = new Player(iframeRef.current);
    vimeoPlayerRef.current = player;

    player.ready().then(async () => {
      const playerDuration = await player.getDuration().catch(() => 0);
      const effectiveDuration = lessonDuration > 0 ? lessonDuration : playerDuration || 0;
      const resumeTime = effectiveDuration > 0
        ? Math.min(resumeSeconds, Math.max(effectiveDuration - 1, 0))
        : resumeSeconds;

      if (resumeTime > 0) {
        await player.setCurrentTime(resumeTime).catch(() => undefined);
        syncCurrentTime(resumeTime);
      }
    }).catch(() => undefined);

    player.on("play", () => setPlaying(true));
    player.on("pause", async () => {
      setPlaying(false);
      const seconds = await player.getCurrentTime().catch(() => currentTimeRef.current);
      const effectiveDuration = lessonDuration > 0 ? lessonDuration : 0;
      const clampedSeconds = effectiveDuration > 0 ? Math.min(seconds, effectiveDuration) : seconds;
      syncCurrentTime(clampedSeconds);
      persistProgress(clampedSeconds);
    });
    player.on("timeupdate", ({ seconds, duration: playerDuration }) => {
      const effectiveDuration = lessonDuration > 0 ? lessonDuration : playerDuration || 0;
      const clampedSeconds = effectiveDuration > 0 ? Math.min(seconds, effectiveDuration) : seconds;
      syncCurrentTime(clampedSeconds);
      if (clampedSeconds - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
        persistProgress(clampedSeconds);
      }
      if (!completedRef.current && effectiveDuration > 0 && clampedSeconds >= effectiveDuration * 0.9) {
        completedRef.current = true;
        setCompleted(true);
        onCompleteRef.current(Math.round(effectiveDuration));
        persistProgress(effectiveDuration);
      }
    });
    player.on("ended", async () => {
      setPlaying(false);
      const playerDuration = await player.getDuration().catch(() => 0);
      const finalSeconds = lessonDuration > 0 ? lessonDuration : playerDuration || currentTimeRef.current;
      syncCurrentTime(finalSeconds);
      if (!completedRef.current) {
        completedRef.current = true;
        setCompleted(true);
        onCompleteRef.current(Math.round(finalSeconds));
      }
      persistProgress(finalSeconds);
    });

    return () => {
      player.destroy().catch(() => undefined);
      vimeoPlayerRef.current = null;
    };
  }, [vimeo, videoUrl, lessonDuration, resumeSeconds, persistProgress, syncCurrentTime]);


  const togglePlay = async () => {
    if (vimeo) {
      const player = vimeoPlayerRef.current;
      if (!player) return;
      if (playing) {
        await player.pause().catch(() => undefined);
        persistProgress();
      } else {
        const effectiveDuration = lessonDuration > 0 ? lessonDuration : 0;
        const time = await player.getCurrentTime().catch(() => currentTimeRef.current);
        if (effectiveDuration > 0 && time >= effectiveDuration - 1) {
          await player.setCurrentTime(0).catch(() => undefined);
          syncCurrentTime(0);
          completedRef.current = false;
          setCompleted(false);
        }
        await player.play().catch(() => undefined);
      }
      return;
    }
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      persistProgress(videoRef.current.currentTime);
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    syncCurrentTime(time);
    saveProgressIfNeeded(time);
    if (time >= videoRef.current.duration * 0.9 && !completed) {
      setCompleted(true);
      onComplete(Math.round(time));
    }
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Vimeo player ──
  if (vimeo) {
    const embedUrl = getVimeoEmbedUrl(videoUrl) + (getVimeoEmbedUrl(videoUrl).includes("?") ? "&" : "?") + "autoplay=0&title=0&byline=0&portrait=0";
    const effectiveDur = lessonDuration > 0 ? lessonDuration : 1;
    const vimeoPercent = lessonDuration > 0
      ? Math.min(Math.round((currentTime / effectiveDur) * 100), 100)
      : (completed ? 100 : 0);

    return (
      <div className="overflow-hidden rounded-lg sm:rounded-xl bg-foreground/5">
        {/* Video container — full width on mobile */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={lessonTitle}
          />
        </div>

        {/* Progress bar — thicker on mobile for easier touch */}
        <div className="relative h-2 sm:h-1.5 bg-border">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${vimeoPercent}%` }}
          />
        </div>

        {/* Controls — larger touch targets on mobile */}
        <div className="flex flex-wrap items-center gap-1 px-2 py-2.5 sm:px-4 sm:py-3">
          {/* Navigation buttons */}
          <div className="flex items-center gap-0.5">
            {onPrev && (
              <button onClick={onPrev} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
                <SkipBack className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            )}
            {onNext && (
              <button onClick={onNext} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
                <SkipForward className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            )}
          </div>

          {/* Time display */}
          <span className="tabular-nums text-xs sm:text-xs text-muted-foreground ml-1">
            {formatTime(currentTime)}{lessonDuration > 0 ? ` / ${formatTime(lessonDuration)}` : ""}
          </span>

          <div className="flex-1" />

          {/* Actions */}
          {!completed && lessonDuration <= 0 && (
            <button
              onClick={() => {
                completedRef.current = true;
                setCompleted(true);
                onComplete(Math.round(currentTime || 60));
                persistProgress(currentTime || 60);
              }}
              className="rounded-lg border border-border bg-secondary px-3 py-2 sm:py-1.5 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 touch-manipulation transition-colors"
            >
              Marcar como assistida
            </button>
          )}

          {completed && (
            <button
              onClick={togglePlay}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 sm:py-1.5 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 touch-manipulation transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rever aula
            </button>
          )}
        </div>

        {/* Completion banner */}
        {completed && (
          <div className="border-t border-border/50 bg-green-50 dark:bg-green-900/10 px-4 py-2.5 sm:py-2 text-center text-xs font-medium text-green-700 dark:text-green-400">
            ✓ Aula concluída — "{lessonTitle}"
          </div>
        )}
      </div>
    );
  }

  // ── Native video player ──
  return (
    <div className="overflow-hidden rounded-lg sm:rounded-xl bg-foreground/5">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration || 0);
            // Auto-seek to last watched position
            if (videoRef.current && resumeSeconds > 0) {
              videoRef.current.currentTime = Math.min(resumeSeconds, (videoRef.current.duration || Infinity) - 1);

            }
          }}
          onPause={() => persistProgress(videoRef.current?.currentTime || 0)}
          onEnded={() => {
            setPlaying(false);
            persistProgress(videoRef.current?.duration || currentTimeRef.current);
          }}
          muted={muted}
          playsInline
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-foreground/5 opacity-0 transition-opacity hover:opacity-100 active:opacity-100 touch-manipulation"
        >
          {playing ? (
            <Pause className="h-12 w-12 sm:h-14 sm:w-14 text-card drop-shadow-lg" />
          ) : (
            <Play className="h-12 w-12 sm:h-14 sm:w-14 text-card drop-shadow-lg" />
          )}
        </button>
      </div>

      {/* Seekable progress bar — thick on mobile */}
      <div className="relative h-2 sm:h-1.5 bg-border cursor-pointer touch-manipulation" onClick={(e) => {
        if (!videoRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pct * duration;
      }}>
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-0.5">
          {onPrev && (
            <button onClick={onPrev} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
              <SkipBack className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          )}
          <button onClick={togglePlay} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-foreground hover:text-primary hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
            {playing ? <Pause className="h-5 w-5 sm:h-4 sm:w-4" /> : <Play className="h-5 w-5 sm:h-4 sm:w-4" />}
          </button>
          {onNext && (
            <button onClick={onNext} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
              <SkipForward className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>

        <span className="tabular-nums text-xs text-muted-foreground ml-1">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 sm:py-1 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 tabular-nums touch-manipulation transition-colors"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full mb-1 right-0 rounded-lg border border-border bg-card shadow-lg py-1 z-20 min-w-[4.5rem]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`block w-full px-4 py-2.5 sm:py-2 text-xs text-left transition-colors touch-manipulation ${
                    s === speed ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setMuted(!muted)} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
          {muted ? <VolumeX className="h-5 w-5 sm:h-4 sm:w-4" /> : <Volume2 className="h-5 w-5 sm:h-4 sm:w-4" />}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen()} className="flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 touch-manipulation transition-colors">
          <Maximize className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      </div>

      {completed && (
        <div className="border-t border-border/50 bg-green-50 dark:bg-green-900/10 px-4 py-2.5 sm:py-2 text-center text-xs font-medium text-green-700 dark:text-green-400">
          ✓ Aula concluída — "{lessonTitle}"
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

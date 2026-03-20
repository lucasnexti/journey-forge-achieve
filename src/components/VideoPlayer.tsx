import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  onComplete: (watchedSeconds: number) => void;
  onProgress?: (watchedSeconds: number) => void;
  lessonTitle: string;
  onNext?: () => void;
  onPrev?: () => void;
  initialWatchedSeconds?: number;
  lessonDuration?: number; // duration in seconds from DB
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PROGRESS_SAVE_INTERVAL = 15; // save every 15 seconds

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
  const vimeoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(initialWatchedSeconds);
    setCompleted(false);
    setSpeed(1);
    lastSavedRef.current = 0;
    if (videoRef.current) videoRef.current.playbackRate = 1;
    if (vimeoTimerRef.current) clearInterval(vimeoTimerRef.current);
  }, [videoUrl, initialWatchedSeconds]);

  // Periodic progress save for native video
  const saveProgressIfNeeded = useCallback((time: number) => {
    if (time - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
      lastSavedRef.current = time;
      onProgress?.(Math.round(time));
    }
  }, [onProgress]);

  // Save progress on unmount / lesson change
  useEffect(() => {
    return () => {
      // Save current time on cleanup
      if (currentTime > 0 && onProgress) {
        onProgress(Math.round(currentTime));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => {
    if (!vimeo) return;
    return () => {
      if (vimeoTimerRef.current) clearInterval(vimeoTimerRef.current);
    };
  }, [vimeo]);

  const startVimeoTimer = useCallback(() => {
    if (vimeoTimerRef.current) clearInterval(vimeoTimerRef.current);
    vimeoTimerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        // Periodic save
        if (next - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
          lastSavedRef.current = next;
          onProgress?.(Math.round(next));
        }
        if (duration > 0 && next >= duration * 0.9 && !completed) {
          setCompleted(true);
          onComplete(Math.round(next));
        }
        return next;
      });
    }, 1000);
  }, [duration, completed, onComplete, onProgress]);

  const stopVimeoTimer = () => {
    if (vimeoTimerRef.current) {
      clearInterval(vimeoTimerRef.current);
      vimeoTimerRef.current = null;
    }
  };

  const togglePlay = () => {
    if (vimeo) {
      if (playing) {
        stopVimeoTimer();
        onProgress?.(Math.round(currentTime));
      } else {
        startVimeoTimer();
      }
      setPlaying(!playing);
      return;
    }
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      onProgress?.(Math.round(videoRef.current.currentTime));
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    saveProgressIfNeeded(time);
    if (time >= videoRef.current.duration * 0.9 && !completed) {
      setCompleted(true);
      onComplete(Math.round(time));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Number(e.target.value);
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

  // Vimeo: determine completion threshold
  const vimeoCompletionThreshold = lessonDuration > 0 ? Math.floor(lessonDuration * 0.9) : 0;

  // Vimeo embed - auto-start timer to track time spent on page
  useEffect(() => {
    if (!vimeo) return;
    const timer = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL) {
          lastSavedRef.current = next;
          onProgress?.(Math.round(next));
        }
        // Auto-complete when 90% of lesson duration is reached
        if (vimeoCompletionThreshold > 0 && next >= vimeoCompletionThreshold && !completed) {
          setCompleted(true);
          onComplete(Math.round(next));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimeo, videoUrl, onProgress, vimeoCompletionThreshold]);

  if (vimeo) {
    const embedUrl = getVimeoEmbedUrl(videoUrl) + (getVimeoEmbedUrl(videoUrl).includes("?") ? "&" : "?") + "autoplay=0&title=0&byline=0&portrait=0";
    const vimeoPercent = lessonDuration > 0
      ? Math.min(Math.round((currentTime / lessonDuration) * 100), 100)
      : 0;

    return (
      <div className="overflow-hidden rounded-xl bg-foreground/5">
        <div className="relative aspect-video bg-foreground/10">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={lessonTitle}
          />
        </div>

        {/* Progress bar for Vimeo */}
        {lessonDuration > 0 && (
          <div className="relative h-2 sm:h-1 bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${vimeoPercent}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3">
          {onPrev && (
            <button onClick={onPrev} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
              <SkipBack className="h-4 w-4" />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
              <SkipForward className="h-4 w-4" />
            </button>
          )}

          <span className="tabular-nums text-[10px] sm:text-xs text-muted-foreground ml-2">
            ⏱ {formatTime(currentTime)}{lessonDuration > 0 ? ` / ${formatTime(lessonDuration)}` : ""}
          </span>

          <div className="flex-1" />

          {/* Fallback button only when no duration is configured */}
          {!completed && lessonDuration <= 0 && (
            <button
              onClick={() => {
                setCompleted(true);
                onComplete(Math.round(currentTime || 60));
              }}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted touch-manipulation"
            >
              Marcar como assistida
            </button>
          )}

          {completed && (
            <span className="rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✓ Concluída
            </span>
          )}
        </div>

        {completed && (
          <div className="border-t border-border/50 bg-green-50 dark:bg-green-900/10 px-4 py-2 text-center text-xs font-medium text-green-700 dark:text-green-400">
            ✓ Aula assistida — "{lessonTitle}" concluída
          </div>
        )}
      </div>
    );
  }

  // Native video player
  return (
    <div className="overflow-hidden rounded-xl bg-foreground/5">
      <div className="relative aspect-video bg-foreground/10">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => { setPlaying(false); onProgress?.(Math.round(currentTime)); }}
          muted={muted}
          playsInline
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-foreground/5 opacity-0 transition-opacity hover:opacity-100 active:opacity-100 touch-manipulation"
        >
          {playing ? (
            <Pause className="h-10 w-10 sm:h-12 sm:w-12 text-card" />
          ) : (
            <Play className="h-10 w-10 sm:h-12 sm:w-12 text-card" />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 sm:h-1 bg-border cursor-pointer touch-manipulation" onClick={(e) => {
        if (!videoRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pct * duration;
      }}>
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3">
        {onPrev && (
          <button onClick={onPrev} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
            <SkipBack className="h-4 w-4" />
          </button>
        )}
        <button onClick={togglePlay} className="p-2 text-foreground transition-colors hover:text-primary touch-manipulation">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {onNext && (
          <button onClick={onNext} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
            <SkipForward className="h-4 w-4" />
          </button>
        )}
        <span className="tabular-nums text-[10px] sm:text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Speed control */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] sm:text-xs font-medium text-foreground hover:bg-muted tabular-nums touch-manipulation"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full mb-1 right-0 rounded-lg border border-border bg-card shadow-lg py-1 z-10">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`block w-full px-4 py-2 text-xs text-left transition-colors touch-manipulation ${
                    s === speed ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setMuted(!muted)} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen()} className="p-2 text-muted-foreground hover:text-foreground touch-manipulation">
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {completed && (
        <div className="border-t border-border/50 bg-green-50 dark:bg-green-900/10 px-4 py-2 text-center text-xs font-medium text-green-700 dark:text-green-400">
          ✓ Aula assistida — "{lessonTitle}" concluída
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  onComplete: (watchedSeconds: number) => void;
  lessonTitle: string;
  onNext?: () => void;
  onPrev?: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const VideoPlayer = ({ videoUrl, onComplete, lessonTitle, onNext, onPrev }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setCompleted(false);
    setSpeed(1);
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, [videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (videoRef.current.currentTime >= videoRef.current.duration * 0.9 && !completed) {
      setCompleted(true);
      onComplete(Math.round(videoRef.current.currentTime));
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

  return (
    <div className="overflow-hidden rounded-xl bg-foreground/5">
      <div className="relative aspect-video bg-foreground/10">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
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

      {/* Progress bar — taller on mobile for easier touch */}
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
        <div className="border-t border-border/50 bg-success/5 px-4 py-2 text-center text-xs font-medium text-success">
          ✓ Aula assistida — "{lessonTitle}" concluída
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
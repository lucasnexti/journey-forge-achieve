import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  onComplete: (watchedSeconds: number) => void;
  lessonTitle: string;
}

const VideoPlayer = ({ videoUrl, onComplete, lessonTitle }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setCompleted(false);
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-foreground/5 opacity-0 transition-opacity hover:opacity-100"
        >
          {playing ? (
            <Pause className="h-12 w-12 text-card" />
          ) : (
            <Play className="h-12 w-12 text-card" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={togglePlay} className="text-foreground transition-colors hover:text-primary">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="tabular-nums text-xs text-muted-foreground w-20">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <input type="range" min={0} max={duration || 0} value={currentTime} onChange={handleSeek} className="flex-1 h-1 cursor-pointer accent-primary" />
        <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen()} className="text-muted-foreground hover:text-foreground">
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

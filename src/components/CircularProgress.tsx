interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress = ({ percent, size = 56, strokeWidth = 4 }: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={percent === 100 ? "hsl(var(--success))" : "hsl(var(--accent))"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular-nums font-display text-xs font-semibold text-foreground">
          {percent}%
        </span>
      </div>
    </div>
  );
};

export default CircularProgress;

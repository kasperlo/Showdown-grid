"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  isPaused?: boolean;
  className?: string;
}

export function Timer({ initialTime, onTimeUp, isPaused = false, className }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    setTimeLeft(initialTime);
    setIsRunning(true);
  }, [initialTime]);

  useEffect(() => {
    if (!isRunning || isPaused || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeLeft, onTimeUp]);

  const progress = (timeLeft / initialTime) * 100;
  const isWarning = timeLeft <= 10;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg className="transform -rotate-90" width="120" height="120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={isWarning ? "hsl(var(--destructive))" : "hsl(var(--accent))"}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-2xl font-bold",
          isWarning && "timer-warning text-destructive"
        )}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  isPaused?: boolean;
  className?: string;
}

export function Timer({
  initialTime,
  onTimeUp,
  isPaused = false,
  className,
}: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  const initialTimeRef = useRef(initialTime);

  // Keep onTimeUp callback ref up to date
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Reset timeLeft when initialTime changes
  useEffect(() => {
    if (initialTimeRef.current !== initialTime) {
      initialTimeRef.current = initialTime;
      queueMicrotask(() => setTimeLeft(initialTime));
    }
  }, [initialTime]);

  // Comprehensive timer effect: handles countdown and pause/resume
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't start if paused or time is up
    if (isPaused || timeLeft <= 0) {
      return;
    }

    // Start countdown
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, timeLeft]);

  const progress = (timeLeft / initialTime) * 100;
  const isWarning = timeLeft <= 10;
  const isFinished = timeLeft === 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        isFinished && "timer-finished",
        className
      )}
    >
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
          stroke={
            isFinished
              ? "hsl(var(--destructive))"
              : isWarning
              ? "hsl(var(--destructive))"
              : "hsl(var(--accent))"
          }
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
          "absolute inset-0 flex items-center justify-center font-bold",
          isFinished ? "text-lg text-destructive" : "text-2xl",
          isWarning && !isFinished && "timer-warning text-destructive"
        )}
      >
        {isFinished ? "SVAR!!!" : formatTime(timeLeft)}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";

interface StreamedTextProps {
  text: string;
  isRunning: boolean;
}

export function StreamedText({ text, isRunning }: StreamedTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (displayedLength >= text.length) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    function step(time: number) {
      // Reveal ~1 character every 15ms for a smooth typing feel
      if (time - lastTimeRef.current >= 15) {
        lastTimeRef.current = time;
        setDisplayedLength((prev) => {
          // Catch up by a few chars if we fell behind
          const remaining = text.length - prev;
          const jump = Math.min(remaining, Math.max(1, Math.floor(remaining / 20)));
          return prev + jump;
        });
      }
      animFrameRef.current = requestAnimationFrame(step);
    }

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [text, displayedLength]);

  // When new text arrives (length increases), we're already behind so animation continues
  // When text resets (new orchestration), reset display
  const prevTextLenRef = useRef(text.length);
  useEffect(() => {
    if (text.length < prevTextLenRef.current) {
      // Text was reset
      setDisplayedLength(0);
    }
    prevTextLenRef.current = text.length;
  }, [text]);

  if (!text) return null;

  const displayed = text.slice(0, displayedLength);

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {displayed}
        {displayedLength < text.length && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-[var(--text-muted)] align-text-bottom" />
        )}
      </p>
    </div>
  );
}

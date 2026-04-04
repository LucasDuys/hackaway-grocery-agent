"use client";

import { useState, useEffect, useRef } from "react";

interface StreamedTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamedText({ text, isStreaming }: StreamedTextProps) {
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
      if (time - lastTimeRef.current >= 15) {
        lastTimeRef.current = time;
        setDisplayedLength((prev) => {
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

  const prevTextLenRef = useRef(text.length);
  useEffect(() => {
    if (text.length < prevTextLenRef.current) {
      setDisplayedLength(0);
    }
    prevTextLenRef.current = text.length;
  }, [text]);

  if (!text) return null;

  const displayed = text.slice(0, displayedLength);

  return (
    <div className="shrink-0 border-t border-[var(--border-light)] bg-[var(--accent-light)] px-4 py-3">
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {displayed}
        {displayedLength < text.length && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-[var(--accent)] align-text-bottom" />
        )}
      </p>
    </div>
  );
}

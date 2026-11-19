"use client";

import { useEffect, useRef, useState } from "react";

const BARS = 32;
const DOTS_PER_COL = 7;
// Decoding the whole file client-side to draw real peaks is fine for
// a few-minute voice memo but not for a multi-hour recording — so
// above this size we skip decoding and draw a calm placeholder instead.
const MAX_DECODE_BYTES = 120 * 1024 * 1024;

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) return "--:--";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function flatBars(value: number) {
  return Array.from({ length: BARS }, () => value);
}

export function Waveform({ file }: { file: File }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [peaks, setPeaks] = useState<number[]>(flatBars(0.12));
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    let cancelled = false;

    if (file.size <= MAX_DECODE_BYTES) {
      (async () => {
        try {
          const AudioCtx =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioCtx();
          const buf = await file.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(buf);
          if (cancelled) return;
          const channel = audioBuffer.getChannelData(0);
          const blockSize = Math.max(1, Math.floor(channel.length / BARS));
          const raw: number[] = [];
          for (let i = 0; i < BARS; i++) {
            let sum = 0;
            const start = i * blockSize;
            for (let j = 0; j < blockSize; j++) sum += Math.abs(channel[start + j] ?? 0);
            raw.push(sum / blockSize);
          }
          const max = Math.max(...raw, 0.0001);
          setPeaks(raw.map((v) => Math.max(v / max, 0.06)));
          setDuration(audioBuffer.duration);
          ctx.close();
        } catch {
          if (!cancelled) setPeaks(flatBars(0.3));
        }
      })();
    } else {
      setPeaks(flatBars(0.3));
    }

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }

  return (
    <div className="waveform">
      <audio
        ref={audioRef}
        src={objectUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (duration === null && Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
      />
      <button type="button" className="waveform-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="waveform-bars" aria-hidden>
        {peaks.map((v, i) => {
          const lit = Math.max(1, Math.round(v * DOTS_PER_COL));
          const played = i / BARS <= progress;
          return (
            <div key={i} className="waveform-col">
              {Array.from({ length: DOTS_PER_COL }, (_, j) => (
                <span
                  key={j}
                  className={`waveform-dot ${
                    j < lit ? (played ? "waveform-dot--played" : "waveform-dot--active") : ""
                  }`}
                />
              ))}
            </div>
          );
        })}
      </div>
      <span className="waveform-duration">{duration !== null ? formatDuration(duration) : "--:--"}</span>
    </div>
  );
}

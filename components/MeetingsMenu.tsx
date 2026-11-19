"use client";

import { useEffect, useRef, useState } from "react";
import { VideoIcon } from "@/components/icons";
import { connectCalendarAction } from "@/app/actions";
import type { Meeting } from "@/lib/types";

const PLATFORM_LABEL: Record<Meeting["platform"], string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Teams",
  whereby: "Whereby",
  other: "Video call",
};

const STATUS_LABEL: Record<Meeting["status"], string> = {
  scheduled: "Scheduled",
  bot_joining: "Joining…",
  in_call: "Recording…",
  call_ended: "Call ended",
  transcribing: "Transcribing…",
  completed: "Transcript ready",
  failed: "Couldn't join",
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today · ${time}` : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

// The "use it as a plugin in meetings" entry point: connect a Google
// Calendar once, and Spool auto-joins anything with a Zoom/Meet/Teams/
// Whereby link a couple of minutes before it starts (see the cron at
// /api/cron/dispatch-bots). This panel also lets someone send the bot
// in manually, for a meeting that's already running or just to test.
export function MeetingsMenu() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meetings");
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setMeetings(data.meetings || []);
    } catch {
      // leave previous state on a transient fetch failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function handleJoinNow(id: string) {
    setJoining(id);
    try {
      const res = await fetch(`/api/meetings/${id}/join`, { method: "POST" });
      const data = await res.json();
      if (data.meeting) {
        setMeetings((prev) => prev.map((m) => (m.id === id ? data.meeting : m)));
      }
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn--pill"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <VideoIcon />
        <span>Meetings</span>
      </button>
      {open && (
        <div className="user-menu__dropdown meetings-menu__dropdown">
          {loading && !meetings.length ? (
            <span className="meetings-menu__empty">Checking your calendar…</span>
          ) : connected === false ? (
            <>
              <p className="meetings-menu__blurb">
                Connect your calendar and Spool joins meetings for you — Zoom, Google Meet, Teams or
                Whereby — and emails you the transcript when the call ends.
              </p>
              <form action={connectCalendarAction}>
                <button type="submit" className="btn btn--pill meetings-menu__connect">
                  Connect calendar
                </button>
              </form>
            </>
          ) : meetings.length === 0 ? (
            <span className="meetings-menu__empty">No video calls on your calendar this week.</span>
          ) : (
            <ul className="meetings-menu__list">
              {meetings.map((m) => (
                <li key={m.id} className="meetings-menu__item">
                  <div className="meetings-menu__item-head">
                    <span className="meetings-menu__title">{m.title}</span>
                    <span className="meetings-menu__when">{formatWhen(m.startTime)}</span>
                  </div>
                  <div className="meetings-menu__item-foot">
                    <span className="meetings-menu__meta">
                      {PLATFORM_LABEL[m.platform]} · {STATUS_LABEL[m.status]}
                    </span>
                    {m.status === "scheduled" && (
                      <button
                        type="button"
                        className="btn btn--ghost meetings-menu__join"
                        disabled={joining === m.id}
                        onClick={() => handleJoinNow(m.id)}
                      >
                        {joining === m.id ? "Sending…" : "Join now"}
                      </button>
                    )}
                    {m.status === "completed" && m.jobId && (
                      <a href={`/t/${m.jobId}`} className="btn btn--ghost meetings-menu__join">
                        View transcript
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

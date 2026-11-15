import React, { useEffect, useState } from 'react';
import { isMuted, setMuted, onMuteChange, unlockAudio } from '../audio.js';

export default function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(setM), []);
  return (
    <button
      className="mute"
      onClick={() => { unlockAudio(); setMuted(!m); }}
      aria-label={m ? 'Включить звук' : 'Выключить звук'}
      title={m ? 'Включить звук' : 'Выключить звук'}
    >
      {m ? (
        <svg viewBox="0 0 16 16" width="20" height="20" shapeRendering="crispEdges"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2zM11 6h1v1h1V6h1v1h-1v1h1v1h-1v1h-1V9h-1V8h1V7h-1z" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" width="20" height="20" shapeRendering="crispEdges"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2zM11 5h1v6h-1zM13 3h1v10h-1z" /></svg>
      )}
    </button>
  );
}

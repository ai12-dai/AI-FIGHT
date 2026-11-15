import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { ARENAS, FIGHTERS } from '../data.js';

export default function MainMenu({ onStart }) {
  const [bg, setBg] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBg((i) => (i + 1) % ARENAS.length), 5000);
    const key = (e) => { if (e.key === 'Enter') onStart(); };
    window.addEventListener('keydown', key);
    return () => { clearInterval(id); window.removeEventListener('keydown', key); };
  }, [onStart]);

  return (
    <div className="menu">
      {ARENAS.map((a, i) => (
        <div key={a.id} className={`menu-bg ${i === bg ? 'on' : ''}`} style={{ backgroundImage: `url(${a.img})` }} />
      ))}
      <div className="menu-shade" />
      <div className="menu-lineup" aria-hidden="true">
        {FIGHTERS.map((f, i) => (
          <img key={f.id} src={f.img} alt="" style={{ '--i': i, transform: f.facing === 'left' ? 'scaleX(-1)' : undefined }} />
        ))}
      </div>
      <div className="menu-center">
        <h1 className="logo" data-text="AI FIGHT">AI FIGHT</h1>
        <p className="tagline">Побеждает тот, кто убедительнее спорит</p>
        <Button onClick={onStart} sound="confirm" className="btn-xl pulse">START GAME</Button>
        <p className="blink hint">PRESS ENTER</p>
      </div>
      <footer className="menu-foot">© 2026 AI FIGHT · 8 FIGHTERS · 3 ARENAS · 1 JUDGE</footer>
    </div>
  );
}

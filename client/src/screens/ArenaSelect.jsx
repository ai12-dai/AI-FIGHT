import React from 'react';
import Button from '../components/Button.jsx';
import { ARENAS } from '../data.js';
import { sfx } from '../audio.js';

export default function ArenaSelect({ match, update, go }) {
  return (
    <div className="page arena-page">
      <h2 className="screen-title">SELECT ARENA</h2>
      <p className="screen-sub">Одна общая арена для обоих бойцов</p>
      <div className="arenas">
        {ARENAS.map((a) => (
          <button
            key={a.id}
            className={`arena-card ${match.arena === a.id ? 'chosen' : ''}`}
            onMouseEnter={() => sfx.hover()}
            onClick={() => { sfx.select(); update({ arena: a.id }); }}
            aria-pressed={match.arena === a.id}
          >
            <div className="arena-thumb" style={{ backgroundImage: `url(${a.thumb})` }} />
            <div className="arena-name">{a.name}</div>
            <div className="arena-sub">{a.subtitle}</div>
            {match.arena === a.id && <div className="arena-check">✓</div>}
          </button>
        ))}
      </div>
      <div className="actions">
        <Button variant="ghost" onClick={() => go('select')}>BACK</Button>
        <Button disabled={!match.arena} sound="confirm" onClick={() => go('form')}>CONTINUE</Button>
      </div>
    </div>
  );
}

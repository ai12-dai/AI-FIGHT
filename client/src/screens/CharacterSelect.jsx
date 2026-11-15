import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { FIGHTERS } from '../data.js';
import { sfx } from '../audio.js';

function Slot({ who, fighter, active, onClick, locked }) {
  const dir = who === 'p1' ? 1 : -1;
  const flip = fighter && (fighter.facing === 'left' ? -1 : 1) !== dir;
  return (
    <button className={`slot slot-${who} ${active ? 'active' : ''} ${locked ? 'locked' : ''}`} onClick={onClick}>
      <div className="slot-label">{who === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}</div>
      <div className="slot-stage">
        {fighter ? (
          <img key={fighter.id} src={fighter.img} alt={fighter.name} className="slot-img pop" style={{ transform: flip ? 'scaleX(-1)' : undefined }} />
        ) : (
          <div className="slot-empty">?</div>
        )}
      </div>
      <div className="slot-name" style={{ color: fighter?.color }}>{fighter ? fighter.name : '— — —'}</div>
      <div className="slot-title">{fighter ? fighter.title : active ? 'ВЫБЕРИТЕ БОЙЦА' : ''}</div>
      {locked && <div className="slot-ready">READY!</div>}
    </button>
  );
}

export default function CharacterSelect({ match, update, go }) {
  const [active, setActive] = useState(match.p1 ? (match.p2 ? 'p1' : 'p2') : 'p1');
  const [cursor, setCursor] = useState(0);
  const [hover, setHover] = useState(null);

  const pick = (id) => {
    const other = active === 'p1' ? 'p2' : 'p1';
    if (match[other] === id) { sfx.deny(); return; }
    sfx.select();
    update({ [active]: id });
    if (!match[other]) setActive(other);
  };

  useEffect(() => {
    const onKey = (e) => {
      const cols = window.innerWidth < 700 ? 2 : 4;
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        sfx.hover();
        setCursor((c) => {
          const d = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -cols, ArrowDown: cols }[e.key];
          const n = (c + d + FIGHTERS.length) % FIGHTERS.length;
          setHover(FIGHTERS[n].id);
          return n;
        });
      } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        pick(FIGHTERS[cursor].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const preview = (who) => {
    if (who === active && hover && !(match[who] && hover === match[who])) {
      const other = who === 'p1' ? 'p2' : 'p1';
      if (hover !== match[other]) return FIGHTERS.find((f) => f.id === hover);
    }
    return FIGHTERS.find((f) => f.id === match[who]);
  };
  const ready = match.p1 && match.p2;

  return (
    <div className="page select">
      <h2 className="screen-title">SELECT YOUR FIGHTER</h2>
      <p className="screen-sub">
        Сейчас выбирает <b className={active}>{active === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}</b>. Нажмите на слот игрока, чтобы сменить выбор.
      </p>
      <div className="select-layout">
        <Slot who="p1" fighter={preview('p1')} active={active === 'p1'} locked={!!match.p1 && active !== 'p1'} onClick={() => { sfx.click(); setActive('p1'); }} />
        <div className="roster" onMouseLeave={() => setHover(null)}>
          {FIGHTERS.map((f, i) => {
            const by1 = match.p1 === f.id, by2 = match.p2 === f.id;
            const takenByOther = (active === 'p1' && by2) || (active === 'p2' && by1);
            return (
              <button
                key={f.id}
                className={`card ${i === cursor ? 'cursor' : ''} ${by1 ? 'by-p1' : ''} ${by2 ? 'by-p2' : ''} ${takenByOther ? 'taken' : ''}`}
                style={{ '--c': f.color }}
                onMouseEnter={() => { setCursor(i); setHover(f.id); sfx.hover(); }}
                onFocus={() => { setCursor(i); setHover(f.id); }}
                onClick={() => pick(f.id)}
                aria-label={`${f.name} — ${f.title}${takenByOther ? ' (занят)' : ''}`}
                aria-disabled={takenByOther}
              >
                <img src={f.img} alt="" loading="eager" />
                <span className="card-name">{f.name}</span>
                {by1 && <span className="badge b1">P1</span>}
                {by2 && <span className="badge b2">P2</span>}
              </button>
            );
          })}
        </div>
        <Slot who="p2" fighter={preview('p2')} active={active === 'p2'} locked={!!match.p2 && active !== 'p2'} onClick={() => { sfx.click(); setActive('p2'); }} />
      </div>
      <p className="bio">{(preview(active) || {}).bio || ' '}</p>
      <div className="actions">
        <Button variant="ghost" onClick={() => go('menu')}>BACK</Button>
        <Button disabled={!ready} sound="confirm" onClick={() => go('arena')}>CONFIRM</Button>
      </div>
    </div>
  );
}

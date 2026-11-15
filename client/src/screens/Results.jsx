import React, { useEffect } from 'react';
import Button from '../components/Button.jsx';
import { CRITERIA } from '@rules';
import { sfx } from '../audio.js';

function List({ title, items, kind }) {
  return (
    <div className={`list ${kind}`}>
      <h4>{title}</h4>
      {items.length ? <ul>{items.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="muted">—</p>}
    </div>
  );
}

export default function Results({ verdict: v, match, f1, f2, arena, onRematch, onNewGame }) {
  useEffect(() => { v?.winner === 'draw' ? sfx.draw() : sfx.victory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null;
  const names = { p1: match.names.p1.trim(), p2: match.names.p2.trim() };
  const draw = v.winner === 'draw';
  const W = v.winner === 'player1' ? 'p1' : 'p2';
  const wf = W === 'p1' ? f1 : f2;

  return (
    <div className="page results" style={{ '--arena': `url(${arena?.img})` }}>
      <div className="results-hero">
        {draw ? (
          <div className="hero-draw">
            <img src={f1.img} alt={f1.name} style={{ transform: f1.facing === 'left' ? 'scaleX(-1)' : undefined }} />
            <div className="hero-text">
              <div className="winner-label">RESULT</div>
              <h2 className="winner-name draw">DRAW</h2>
              <div className="hero-sub">{names.p1} и {names.p2} — на равных</div>
            </div>
            <img src={f2.img} alt={f2.name} style={{ transform: f2.facing === 'left' ? undefined : 'scaleX(-1)' }} />
          </div>
        ) : (
          <div className="hero-win">
            <div className="victory-sprite" style={{ '--c': wf.color }}>
              <img src={wf.img} alt={wf.name} />
            </div>
            <div className="hero-text">
              <div className="winner-label">WINNER</div>
              <h2 className="winner-name">{names[W]}</h2>
              <div className="hero-sub">{W === 'p1' ? 'PLAYER 1' : 'PLAYER 2'} · {wf.name}</div>
            </div>
          </div>
        )}
        <div className="scoreline">
          <div className={`score ${v.winner === 'player1' ? 'win' : ''}`}><span>{names.p1}</span><b>{v.player1_score}</b></div>
          <div className="score-sep">:</div>
          <div className={`score ${v.winner === 'player2' ? 'win' : ''}`}><b>{v.player2_score}</b><span>{names.p2}</span></div>
        </div>
        <p className="verdict-line">«{v.final_verdict}»</p>
      </div>

      <section className="panel">
        <h3>ОЦЕНКА ПО КРИТЕРИЯМ</h3>
        <div className="crit-legend"><span className="l1">{names.p1}</span><span className="l2">{names.p2}</span></div>
        {CRITERIA.map((c) => {
          const a = v.player1_criteria?.[c.key] ?? 0, b = v.player2_criteria?.[c.key] ?? 0;
          return (
            <div className="crit" key={c.key}>
              <div className="crit-head"><span>{c.label} <small>{c.weight}%</small></span><span>{a} : {b}</span></div>
              <div className="crit-bars">
                <div className="cb cb1"><div style={{ width: `${a}%` }} /></div>
                <div className="cb cb2"><div style={{ width: `${b}%` }} /></div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="sw-grid">
        <section className="panel p1side">
          <h3>{names.p1} <small>· {f1.name}</small></h3>
          <List title="Сильные стороны" items={v.player1_strengths} kind="good" />
          <List title="Слабые стороны" items={v.player1_weaknesses} kind="bad" />
        </section>
        <section className="panel p2side">
          <h3>{names.p2} <small>· {f2.name}</small></h3>
          <List title="Сильные стороны" items={v.player2_strengths} kind="good" />
          <List title="Слабые стороны" items={v.player2_weaknesses} kind="bad" />
        </section>
      </div>

      <section className="panel">
        <h3>РЕШЕНИЕ СУДЬИ</h3>
        <p className="reasoning">{v.reasoning}</p>
        <p className="meta">
          Тестовый судья
          {v.confidence ? ` · уверенность: ${{ low: 'низкая', medium: 'средняя', high: 'высокая' }[v.confidence] || v.confidence}` : ''}
        </p>
      </section>

      <div className="actions sticky">
        <Button variant="alt" onClick={onRematch}>REMATCH</Button>
        <Button onClick={onNewGame} sound="confirm">NEW GAME</Button>
      </div>
    </div>
  );
}

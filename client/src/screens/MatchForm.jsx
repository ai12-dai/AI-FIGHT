import React, { useState } from 'react';
import Button from '../components/Button.jsx';
import { LIMITS, validateMatch } from '@rules';
import { EXAMPLE } from '../data.js';
import { sfx } from '../audio.js';

function PlayerBlock({ who, fighter, name, arg, setName, setArg }) {
  const words = arg.trim().split(/\s+/).filter(Boolean).length;
  const tooShort = arg.trim().length > 0 && (arg.trim().length < LIMITS.argMin || words < LIMITS.argMinWords);
  return (
    <section className={`pblock pblock-${who}`} style={{ '--c': fighter?.color }}>
      <header>
        <img src={fighter?.img} alt="" style={{ transform: (fighter?.facing === 'left') !== (who === 'p2') ? 'scaleX(-1)' : undefined }} />
        <div>
          <div className="pb-label">{who === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}</div>
          <div className="pb-fighter">{fighter?.name}</div>
        </div>
      </header>
      <label>
        <span>Имя участника</span>
        <input value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} placeholder={`Например, ${who === 'p1' ? EXAMPLE.name1 : EXAMPLE.name2}`} autoComplete="off" />
      </label>
      <label>
        <span>Позиция и аргументы</span>
        <textarea value={arg} maxLength={LIMITS.argMax} rows={7} onChange={(e) => setArg(e.target.value)} placeholder={`Например: ${who === 'p1' ? EXAMPLE.p1 : EXAMPLE.p2}`} />
      </label>
      <div className={`counter ${tooShort ? 'warn' : ''}`}>
        {tooShort ? `минимум ${LIMITS.argMin} символов и ${LIMITS.argMinWords} слов · ` : ''}{arg.length} / {LIMITS.argMax}
      </div>
    </section>
  );
}

export default function MatchForm({ match, update, go, f1, f2 }) {
  const [error, setError] = useState('');
  const edit = (patch) => { setError(''); update(patch); };
  const setName = (k) => (v) => edit({ names: { ...match.names, [k]: v } });
  const setArg = (k) => (v) => edit({ args: { ...match.args, [k]: v } });

  const submit = () => {
    const m = {
      topic: match.topic,
      player1: { name: match.names.p1, argument: match.args.p1 },
      player2: { name: match.names.p2, argument: match.args.p2 },
    };
    const err = validateMatch(m);
    if (err) { setError(err); sfx.deny(); return; }
    setError('');
    go('judging');
  };

  const fillExample = () => {
    edit({
      topic: EXAMPLE.topic,
      names: { p1: EXAMPLE.name1, p2: EXAMPLE.name2 },
      args: { p1: EXAMPLE.p1, p2: EXAMPLE.p2 },
    });
  };

  return (
    <div className="page form-page">
      <h2 className="screen-title">ENTER THE DEBATE</h2>
      <label className="topic">
        <span>TOPIC — тема спора</span>
        <input value={match.topic} maxLength={LIMITS.topicMax} onChange={(e) => edit({ topic: e.target.value })} placeholder={`Например: ${EXAMPLE.topic}`} autoComplete="off" />
      </label>
      <div className="pblocks">
        <PlayerBlock who="p1" fighter={f1} name={match.names.p1} arg={match.args.p1} setName={setName('p1')} setArg={setArg('p1')} />
        <div className="vs">VS</div>
        <PlayerBlock who="p2" fighter={f2} name={match.names.p2} arg={match.args.p2} setName={setName('p2')} setArg={setArg('p2')} />
      </div>
      <div className="form-tools">
        <button className="linkish" onClick={() => { sfx.click(); fillExample(); }}>Заполнить пример</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        <Button variant="ghost" onClick={() => go('arena')}>BACK</Button>
        <Button sound="confirm" className="btn-xl" onClick={submit}>START BATTLE</Button>
      </div>
    </div>
  );
}

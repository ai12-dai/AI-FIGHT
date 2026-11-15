import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import { requestVerdict } from '../api.js';
import { sfx } from '../audio.js';

const STEPS = [
  'Читаю позиции участников…',
  'Проверяю логику аргументов…',
  'Ищу логические ошибки…',
  'Оцениваю обоснованность фактов…',
  'Сравниваю работу с контраргументами…',
  'Выношу вердикт…',
];

export default function Judging({ match, arena, f1, f2, go, setVerdict }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const ctrl = useRef(null);

  useEffect(() => {
    setError(null);
    setStep(0);
    const ac = new AbortController();
    ctrl.current = ac;
    const tick = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 350);
    const started = Date.now();
    requestVerdict({
      topic: match.topic.trim(),
      player1: { name: match.names.p1.trim(), argument: match.args.p1.trim() },
      player2: { name: match.names.p2.trim(), argument: match.args.p2.trim() },
    }, ac.signal)
      .then(async (v) => {
        // keep a short dramatic pause before the fight
        const min = 2200;
        const left = min - (Date.now() - started);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
        if (ac.signal.aborted) return;
        setVerdict(v);
        go('battle');
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        sfx.deny();
        setError(e);
      })
      .finally(() => clearInterval(tick));
    return () => { ac.abort(); clearInterval(tick); };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="judging" style={{ backgroundImage: `url(${arena?.img})` }}>
      <div className="judging-shade" />
      <div className="judging-fighters">
        <img src={f1?.img} alt="" style={{ transform: f1?.facing === 'left' ? 'scaleX(-1)' : undefined }} />
        <div className="judge-core">
          <div className={`ai-eye ${error ? 'err' : ''}`}><span /></div>
        </div>
        <img src={f2?.img} alt="" style={{ transform: f2?.facing === 'left' ? undefined : 'scaleX(-1)' }} />
      </div>
      <div className="judging-panel" aria-live="polite">
        {!error ? (
          <>
            <h2 className="screen-title small">JUDGE IS THINKING</h2>
            <p className="step">{STEPS[step]}</p>
            <div className="loader"><div style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
            <p className="muted">Судья оценивает аргументы по пяти критериям</p>
            <Button variant="ghost" onClick={() => { ctrl.current?.abort(); go('form'); }}>CANCEL</Button>
          </>
        ) : (
          <>
            <h2 className="screen-title small err">JUDGE ERROR</h2>
            <p className="step">{error.message}</p>
            <div className="actions">
              <Button variant="ghost" onClick={() => go('form')}>EDIT</Button>
              {error.code !== 'invalid_input' && <Button onClick={() => setAttempt((a) => a + 1)}>RETRY</Button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

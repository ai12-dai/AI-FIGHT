import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import BattleScene from '../game/BattleScene.js';
import Button from '../components/Button.jsx';
import { sfx, announce } from '../audio.js';

export default function Battle({ match, arena, f1, f2, verdict, go }) {
  const host = useRef(null);
  const game = useRef(null);
  const [ended, setEnded] = useState(false);
  const [fast, setFast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try { await document.fonts.load('32px "Press Start 2P"'); } catch { /* fallback font */ }
      if (cancelled) return;
      game.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 1280,
        height: 720,
        backgroundColor: '#12002a',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, roundPixels: false },
        audio: { noAudio: true },
        banner: false,
      });
      game.current.scene.add('battle', BattleScene, true, {
        verdict, arena, f1, f2,
        names: { p1: match.names.p1.trim(), p2: match.names.p2.trim() },
        sfx, announce,
        onEnd: () => !cancelled && setEnded(true),
      });
    };
    start();
    // re-fit the canvas when the phone rotates or the window changes size
    const ro = new ResizeObserver(() => game.current?.scale.refresh());
    ro.observe(host.current);
    return () => { cancelled = true; ro.disconnect(); game.current?.destroy(true); game.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => go('results'), 7000);
    const k = (e) => { if (e.key === 'Enter') go('results'); };
    window.addEventListener('keydown', k);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); };
  }, [ended, go]);

  const toggleFast = () => {
    const s = game.current?.scene.getScene('battle');
    const next = !fast;
    s?.setSpeed(next ? 3 : 1);
    setFast(next);
  };

  return (
    <div className="battle">
      <div className="battle-stage" ref={host} />
      <div className="battle-ui">
        {!ended ? (
          <button className="chip" onClick={() => { sfx.click(); toggleFast(); }}>{fast ? '▶ NORMAL' : '▶▶ FAST'}</button>
        ) : (
          <Button className="btn-xl pulse" sound="confirm" onClick={() => go('results')}>RESULTS ▶</Button>
        )}
      </div>
      <div className="rotate-hint">Поверните телефон горизонтально ↻</div>
    </div>
  );
}

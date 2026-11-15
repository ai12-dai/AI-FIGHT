import React, { useEffect, useState, useCallback } from 'react';
import MainMenu from './screens/MainMenu.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import ArenaSelect from './screens/ArenaSelect.jsx';
import MatchForm from './screens/MatchForm.jsx';
import Judging from './screens/Judging.jsx';
import Battle from './screens/Battle.jsx';
import Results from './screens/Results.jsx';
import MuteButton from './components/MuteButton.jsx';
import { playMusic, unlockAudio } from './audio.js';
import { fighterById, arenaById } from './data.js';

const EMPTY = {
  p1: null, p2: null, arena: null,
  topic: '', names: { p1: '', p2: '' }, args: { p1: '', p2: '' },
};

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [match, setMatch] = useState(EMPTY);
  const [verdict, setVerdict] = useState(null);
  useEffect(() => {
    const music = { menu: 'menu', select: 'menu', arena: 'menu', form: 'menu', judging: 'menu', battle: 'battle', results: 'results' }[screen];
    playMusic(music);
  }, [screen]);
  // unlock audio on the first interaction anywhere
  useEffect(() => {
    const h = () => { unlockAudio(); playMusic(screen === 'battle' ? 'battle' : screen === 'results' ? 'results' : 'menu'); };
    window.addEventListener('pointerdown', h, { once: true });
    window.addEventListener('keydown', h, { once: true });
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((s) => { setScreen(s); window.scrollTo(0, 0); }, []);
  const update = useCallback((patch) => setMatch((m) => ({ ...m, ...patch })), []);

  const ctx = {
    match, update, go, verdict, setVerdict,
    f1: fighterById(match.p1), f2: fighterById(match.p2), arena: arenaById(match.arena),
  };

  return (
    <div className={`app screen-${screen}`}>
      <MuteButton />
      {screen === 'menu' && <MainMenu onStart={() => go('select')} />}
      {screen === 'select' && <CharacterSelect {...ctx} />}
      {screen === 'arena' && <ArenaSelect {...ctx} />}
      {screen === 'form' && <MatchForm {...ctx} />}
      {screen === 'judging' && <Judging {...ctx} />}
      {screen === 'battle' && <Battle {...ctx} />}
      {screen === 'results' && (
        <Results
          {...ctx}
          onRematch={() => { setVerdict(null); go('form'); }}
          onNewGame={() => { setVerdict(null); setMatch(EMPTY); go('select'); }}
        />
      )}
      <div className="crt" aria-hidden="true" />
    </div>
  );
}

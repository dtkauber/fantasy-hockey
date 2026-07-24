import { useState } from 'react';
import { Rankings } from './components/Rankings';
import { PlayerPool } from './components/PlayerPool';
import { LeagueManager } from './components/LeagueManager';
import './App.css';

type Tab = 'rankings' | 'players' | 'leagues';

function App() {
  const [tab, setTab] = useState<Tab>('rankings');

  return (
    <div className="app">
      <h1>Fantasy Hockey Manager</h1>
      <nav className="tabs">
        <button className={tab === 'rankings' ? 'active' : ''} onClick={() => setTab('rankings')}>
          Rankings
        </button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          Players
        </button>
        <button className={tab === 'leagues' ? 'active' : ''} onClick={() => setTab('leagues')}>
          Leagues &amp; Draft
        </button>
      </nav>
      {tab === 'rankings' && <Rankings />}
      {tab === 'players' && <PlayerPool />}
      {tab === 'leagues' && <LeagueManager />}
    </div>
  );
}

export default App;

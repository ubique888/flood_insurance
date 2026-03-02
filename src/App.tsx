import { useState, useRef, useCallback } from 'react';
import { FloodplainEnvironment } from './simulation/environment';
import IndividualView from './components/IndividualView';
import SocietyView from './components/SocietyView';
import PolicyView from './components/PolicyView';
import './App.css';

type View = 'individual' | 'society' | 'policy';

export default function App() {
  const envRef = useRef(new FloodplainEnvironment());
  const [view, setView] = useState<View>('individual');
  const [narrative, setNarrative] = useState(
    'Select a view above to begin exploring how governance shapes rational behavior.',
  );

  const switchView = useCallback((v: View) => {
    envRef.current.reset();
    setView(v);
  }, []);

  const env = envRef.current;

  return (
    <div className="app">
      <header className="header">
        <h1>The Floodplain</h1>
        <p className="subtitle">How calculated governance shapes behavior without direct commands</p>
      </header>

      <nav className="nav">
        <button
          className={`nav-btn ${view === 'individual' ? 'active' : ''}`}
          onClick={() => switchView('individual')}
        >
          1. Individual
        </button>
        <button
          className={`nav-btn ${view === 'society' ? 'active' : ''}`}
          onClick={() => switchView('society')}
        >
          2. Society
        </button>
        <button
          className={`nav-btn ${view === 'policy' ? 'active' : ''}`}
          onClick={() => switchView('policy')}
        >
          3. Policy Intervention
        </button>
      </nav>

      <main className="main">
        {view === 'individual' && (
          <IndividualView env={env} onNarrative={setNarrative} />
        )}
        {view === 'society' && (
          <SocietyView env={env} onNarrative={setNarrative} />
        )}
        {view === 'policy' && (
          <PolicyView env={env} onNarrative={setNarrative} />
        )}
      </main>

      <footer className="narrative">
        <p>{narrative}</p>
      </footer>
    </div>
  );
}

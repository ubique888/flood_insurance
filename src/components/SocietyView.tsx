import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FloodplainEnvironment } from '../simulation/environment';
import GridCanvas from './GridCanvas';
import Explainer, { Formula, V, Section, Insight, Diagram } from './Explainer';
import FormulaPanel from './FormulaPanel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  env: FloodplainEnvironment;
  onNarrative: (text: string) => void;
}

export default function SocietyView({ env, onNarrative }: Props) {
  const [phase, setPhase] = useState<'explain' | 'simulate'>('explain');
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(50);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onNarrative(
      phase === 'explain'
        ? 'Before the simulation: understanding how individual rationality scales to collective patterns.'
        : '150 rational agents share the same floodplain. No one is told what to do — yet patterns emerge.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startSim = useCallback(() => {
    if (env.societyAgents.length === 0) {
      env.initSociety(150);
      setTick((t) => t + 1);
    }
    setPhase('simulate');
  }, [env]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const steps = Math.max(1, Math.ceil(speed / 30));
      for (let i = 0; i < steps; i++) env.stepSociety();
      setTick((t) => t + 1);
    }, 120);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, speed, env]);

  const reset = useCallback(() => {
    setRunning(false);
    env.reset();
    env.initSociety(150);
    setTick((t) => t + 1);
  }, [env]);

  const flood = useCallback(() => {
    env.triggerFlood(0.7);
    setTick((t) => t + 1);
    onNarrative('A major flood event strikes. Uninsured agents in high-risk zones suffer heavy losses.');
  }, [env, onNarrative]);

  // ── Explain phase ──

  if (phase === 'explain') {
    return (
      <Explainer
        title="From Individual to Society"
        subtitle="How 150 rational agents produce emergent collective patterns"
        onStart={startSim}
        buttonLabel="Start Society Simulation"
      >
        <Section title="Scaling Up">
          <p>
            Instead of one agent, we now place <strong>150 independent agents</strong> on the
            same floodplain. Each evaluates nearby cells using a utility function:
          </p>
          <Formula>
            <V color="green">Utility(cell)</V> = <V color="green">Income</V> &minus; min(<V color="blue">Insured Cost</V>, <V color="red">Uninsured Cost</V>) &minus; <V color="orange">Zoning Penalty</V>
          </Formula>
          <div className="formula-details">
            <div className="fd-row">
              <V color="blue">Insured Cost</V> = <V color="dim">Premium + Risk &times; Damage &times; Deductible</V>
            </div>
            <div className="fd-row">
              <V color="red">Uninsured Cost</V> = <V color="dim">Risk &times; Damage &times; (1 &minus; Relief)</V>
            </div>
          </div>
          <p>
            Each agent moves toward whichever neighboring cell offers the highest utility.
            They automatically choose insurance when its expected cost is lower than going uninsured.
          </p>
        </Section>

        <Section title="Emergent Patterns">
          <Diagram>
            <div className="diagram-flow">
              <div className="diagram-step">
                <div className="diagram-num">1</div>
                <span>Individual agents evaluate nearby cells</span>
              </div>
              <div className="diagram-arrow">&rarr;</div>
              <div className="diagram-step">
                <div className="diagram-num">2</div>
                <span>Each moves toward highest utility</span>
              </div>
              <div className="diagram-arrow">&rarr;</div>
              <div className="diagram-step">
                <div className="diagram-num">3</div>
                <span>Settlement clusters emerge</span>
              </div>
            </div>
          </Diagram>
          <p>
            No central planner directs where people live. Yet patterns form:
            clusters of settlement, zones of avoidance, varying insurance uptake.
            This parallels how real housing markets self-organize.
          </p>
        </Section>

        <Section title="Information & Perception">
          <p>
            Without government risk disclosure, agents <strong>underestimate</strong> flood
            risk (normalcy bias). Their perception updates based on experience:
          </p>
          <Formula>
            <V color="red">Perceived Risk</V> &larr; <V color="red">Perceived Risk</V> + <V color="dim">0.3</V>
            <span className="formula-label">after a flood</span>
          </Formula>
          <Formula>
            <V color="red">Perceived Risk</V> &larr; <V color="red">Perceived Risk</V> &times; <V color="dim">0.98</V>
            <span className="formula-label">each calm step</span>
          </Formula>
          <p>
            People quickly learn from disasters — but slowly forget. This asymmetry
            means risk awareness fades between events.
          </p>
        </Section>

        <Insight>
          Individual rationality produces collective patterns that look "governed" —
          but no one is in charge. The <strong>structure of incentives</strong> does
          the governing. This is what Rose and Miller call "governing at a distance."
        </Insight>
      </Explainer>
    );
  }

  // ── Simulate phase ──

  const snap = env.getSnapshot();

  const distData = {
    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
    datasets: [{
      label: 'Agents',
      data: snap.distributionByRisk,
      backgroundColor: ['#66bb6a', '#ffa726', '#ef5350'],
    }],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  } as const;

  return (
    <div className="view-layout">
      <div className="grid-panel">
        <GridCanvas env={env} tick={tick} mode="society" />
        <div className="grid-legend">
          <span className="lg"><span className="dot" style={{ background: '#2d6a3f' }} /> Low risk</span>
          <span className="lg"><span className="dot" style={{ background: '#c8a833' }} /> Medium risk</span>
          <span className="lg"><span className="dot" style={{ background: '#d94f3b' }} /> High risk</span>
          <span className="lg"><span className="dot" style={{ background: '#1565c0' }} /> Water</span>
          <span className="lg"><span className="dot agent-unins" /> Uninsured</span>
          <span className="lg"><span className="dot agent-ins" /> Insured</span>
        </div>
        <FormulaPanel mode="society" policy={env.policy} />
      </div>

      <div className="info-panel">
        <h2>Society</h2>
        <p className="desc">
          Hundreds of rational agents inhabit the floodplain. Watch settlement patterns
          emerge — then trigger a flood to see what happens.
        </p>

        <div className="info-block">
          <h3>Population Statistics</h3>
          <div className="stats">
            <div className="stat"><span>Total agents</span><span>{snap.totalAgents}</span></div>
            <div className="stat"><span>In high-risk zones</span><span>{snap.agentsInHighRisk}</span></div>
            <div className="stat"><span>Insured</span><span>{snap.agentsInsured}</span></div>
            <div className="stat"><span>Avg wealth</span><span>{snap.avgWealth.toFixed(1)}</span></div>
            <div className="stat"><span>Flood events</span><span>{snap.floodEvents}</span></div>
            <div className="stat"><span>Step</span><span>{snap.step}</span></div>
          </div>
        </div>

        <div className="info-block chart-block">
          <h3>Settlement Distribution</h3>
          <div className="chart-container">
            <Bar data={distData} options={chartOpts} />
          </div>
        </div>

        <div className="controls">
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Run'}
          </button>
          <button className="btn" onClick={reset}>Reset</button>
          <button className="btn danger" onClick={flood}>Trigger Flood</button>
          <label className="speed">
            Speed
            <input type="range" min={1} max={100} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );
}

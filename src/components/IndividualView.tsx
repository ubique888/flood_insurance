import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { FloodplainEnvironment } from '../simulation/environment';
import GridCanvas from './GridCanvas';
import Explainer, { Formula, V, Section, Insight, Diagram } from './Explainer';
import FormulaPanel from './FormulaPanel';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title, Tooltip, Legend,
);

interface Props {
  env: FloodplainEnvironment;
  onNarrative: (text: string) => void;
}

export default function IndividualView({ env, onNarrative }: Props) {
  const [phase, setPhase] = useState<'explain' | 'simulate'>('explain');
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onNarrative(
      phase === 'explain'
        ? 'Before the simulation: understanding the model behind a single rational agent.'
        : 'Meet Agent 0. Watch as they learn through experience where to live and whether to buy insurance.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startSim = useCallback(() => {
    if (!env.individualAgent) {
      env.initIndividual();
      setTick((t) => t + 1);
    }
    setPhase('simulate');
  }, [env]);

  // Simulation loop
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const steps = Math.max(1, Math.ceil(speed / 30));
      for (let i = 0; i < steps; i++) env.stepIndividual();
      setTick((t) => t + 1);
    }, 120);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, speed, env]);

  const step = useCallback(() => {
    env.stepIndividual();
    setTick((t) => t + 1);
  }, [env]);

  const reset = useCallback(() => {
    setRunning(false);
    env.reset();
    env.initIndividual();
    setTick((t) => t + 1);
  }, [env]);

  // ── Explain phase ──

  if (phase === 'explain') {
    return (
      <Explainer
        title="The Rational Individual"
        subtitle="How a single agent learns to navigate risk and reward"
        onStart={startSim}
        buttonLabel="Start Individual Simulation"
      >
        <Section title="The Setup">
          <p>
            An agent lives on a floodplain. Each cell of land has two properties
            that create a fundamental tension:
          </p>
          <Diagram>
            <div className="diagram-row">
              <div className="diagram-card green">
                <strong>Income</strong>
                <span>Higher near the river</span>
                <span className="diagram-sub">(fertile floodplain)</span>
              </div>
              <div className="diagram-card red">
                <strong>Flood Risk</strong>
                <span>Also higher near the river</span>
                <span className="diagram-sub">(proximity to water)</span>
              </div>
            </div>
            <p className="diagram-caption">The most productive land is also the most dangerous.</p>
          </Diagram>
        </Section>

        <Section title="The Reward Function">
          <p>
            Each time step, the agent receives a reward based on where it lives
            and whether it holds insurance:
          </p>
          <Formula>
            <V color="green">Reward</V> = <V color="green">Income</V> &minus; <V color="blue">Insurance Cost</V> &minus; <V color="red">Flood Damage</V> + <V color="cyan">Relief</V>
          </Formula>
          <div className="formula-details">
            <div className="fd-row">
              <V color="blue">Insurance Cost</V> = <V color="dim">Risk &times; Damage &times; Load &times; (1 &minus; Subsidy)</V>
              <span className="fd-note">if insured</span>
            </div>
            <div className="fd-row">
              <V color="red">Flood Damage</V> = <V color="dim">Damage &times; (1 &minus; Relief)</V>
              <span className="fd-note">if flooded &amp; uninsured</span>
            </div>
            <div className="fd-row">
              <V color="red">Flood Damage</V> = <V color="dim">Damage &times; Deductible</V>
              <span className="fd-note">if flooded &amp; insured</span>
            </div>
          </div>
        </Section>

        <Section title="Q-Learning: Learning by Experience">
          <p>
            The agent doesn't know the optimal strategy in advance. It learns
            through trial and error using <strong>Q-learning</strong> &mdash; a
            reinforcement learning algorithm that assigns a quality value to each
            state-action pair:
          </p>
          <Formula>
            <V color="accent">Q(s, a)</V> &larr; <V color="accent">Q(s, a)</V> + <V color="dim">&alpha;</V> &middot; [<V color="green">reward</V> + <V color="dim">&gamma;</V> &middot; max <V color="accent">Q(s', a')</V> &minus; <V color="accent">Q(s, a)</V>]
          </Formula>
          <div className="formula-details">
            <div className="fd-row">
              <V color="dim">&alpha;</V> = learning rate &mdash; how quickly new experience overrides old beliefs
            </div>
            <div className="fd-row">
              <V color="dim">&gamma;</V> = discount factor &mdash; how much the agent values future rewards
            </div>
            <div className="fd-row">
              <V color="dim">&epsilon;</V> = exploration rate &mdash; probability of trying a random action (decays over time)
            </div>
          </div>
        </Section>

        <Insight>
          Nobody tells the agent where to live or whether to insure.
          The <strong>reward function</strong> alone shapes behavior.
          This is the core mechanism of governance through calculation:
          design the incentives, and rational actors govern themselves.
        </Insight>
      </Explainer>
    );
  }

  // ── Simulate phase ──

  const ag = env.individualAgent;
  const d = ag?.data;
  const snap = env.getSnapshot();

  const wealthData = d ? {
    labels: d.wealthHistory.slice(-80).map((_, i) => String(i)),
    datasets: [{
      label: 'Wealth',
      data: d.wealthHistory.slice(-80),
      borderColor: '#42a5f5',
      backgroundColor: 'rgba(66,165,245,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    }],
  } : null;

  const last = d?.lastStepResult;
  const breakdownData = last ? {
    labels: ['Income', 'Insurance', 'Flood Dmg', 'Relief', 'Zoning'],
    datasets: [{
      label: 'Reward Breakdown',
      data: [
        last.income,
        -last.insuranceCost,
        -last.floodDamage,
        last.reliefPayment,
        -last.zoningPenalty,
      ],
      backgroundColor: [
        '#66bb6a', '#ef5350', '#d32f2f', '#42a5f5', '#ffa726',
      ],
    }],
  } : null;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { beginAtZero: true } },
  } as const;

  return (
    <div className="view-layout">
      <div className="grid-panel">
        <GridCanvas env={env} tick={tick} mode="individual" showQValues />
        <div className="grid-legend">
          <span className="lg"><span className="dot" style={{ background: '#2d6a3f' }} /> Low risk</span>
          <span className="lg"><span className="dot" style={{ background: '#c8a833' }} /> Medium risk</span>
          <span className="lg"><span className="dot" style={{ background: '#d94f3b' }} /> High risk</span>
          <span className="lg"><span className="dot" style={{ background: '#1565c0' }} /> Water</span>
          <span className="lg"><span className="dot agent-unins" /> Agent</span>
          <span className="lg"><span className="dot agent-ins" /> Insured</span>
        </div>
        <FormulaPanel mode="individual" policy={env.policy} epsilon={ag?.epsilon} />
      </div>

      <div className="info-panel">
        <h2>Individual Agent</h2>
        <p className="desc">
          A single Q-learning agent explores the floodplain, learning where to settle and
          whether to buy insurance through trial and error.
        </p>

        <div className="info-block">
          <h3>Agent State</h3>
          <div className="stats">
            <div className="stat"><span>Position</span><span>{d ? `(${d.x}, ${d.y})` : '—'}</span></div>
            <div className="stat"><span>Wealth</span><span>{d ? d.wealth.toFixed(1) : '—'}</span></div>
            <div className="stat"><span>Insured</span><span>{d ? (d.insured ? 'Yes' : 'No') : '—'}</span></div>
            <div className="stat"><span>Reward</span><span>{d ? d.lastReward.toFixed(2) : '—'}</span></div>
            <div className="stat"><span>Step</span><span>{snap.step}</span></div>
            <div className="stat"><span>Epsilon</span><span>{ag ? ag.epsilon.toFixed(3) : '—'}</span></div>
          </div>
        </div>

        {wealthData && (
          <div className="info-block chart-block">
            <h3>Wealth Over Time</h3>
            <div className="chart-container">
              <Line data={wealthData} options={chartOpts} />
            </div>
          </div>
        )}

        {breakdownData && (
          <div className="info-block chart-block">
            <h3>Reward Breakdown</h3>
            <div className="chart-container">
              <Bar data={breakdownData} options={chartOpts} />
            </div>
          </div>
        )}

        <div className="controls">
          <button className="btn" onClick={step}>Step</button>
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Run'}
          </button>
          <button className="btn" onClick={reset}>Reset</button>
          <label className="speed">
            Speed
            <input type="range" min={1} max={100} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );
}

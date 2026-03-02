import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FloodplainEnvironment } from '../simulation/environment';
import type { SimSnapshot } from '../simulation/types';
import GridCanvas from './GridCanvas';
import Explainer, { Formula, V, Section, Insight, Diagram } from './Explainer';
import FormulaPanel from './FormulaPanel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  env: FloodplainEnvironment;
  onNarrative: (text: string) => void;
}

export default function PolicyView({ env, onNarrative }: Props) {
  const [phase, setPhase] = useState<'explain' | 'simulate'>('explain');
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [baseline, setBaseline] = useState<SimSnapshot | null>(null);

  useEffect(() => {
    onNarrative(
      phase === 'explain'
        ? 'Before the simulation: understanding how policy levers reshape the incentive structure.'
        : 'You are the governing body. Adjust the levers — governance through calculation.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startSim = useCallback(() => {
    if (env.societyAgents.length === 0) {
      env.initSociety(150);
    }
    for (let i = 0; i < 30; i++) env.stepSociety();
    setBaseline(env.getSnapshot());
    setTick((t) => t + 1);
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
    for (let i = 0; i < 30; i++) env.stepSociety();
    setBaseline(env.getSnapshot());
    setTick((t) => t + 1);
  }, [env]);

  const flood = useCallback(() => {
    env.triggerFlood(0.8);
    setTick((t) => t + 1);
    onNarrative('A severe flood hits. Observe how your policy choices affected who suffers and who is protected.');
  }, [env, onNarrative]);

  const p = env.policy;
  const update = <K extends keyof typeof env.policy>(key: K, val: (typeof env.policy)[K]) => {
    env.policy[key] = val;
    setTick((t) => t + 1);
    onNarrative(policyNarrative(key, val));
  };

  // ── Explain phase ──

  if (phase === 'explain') {
    return (
      <Explainer
        title="Governance Through Calculation"
        subtitle="How policy levers reshape the reward function — and with it, society"
        onStart={startSim}
        buttonLabel="Start Policy Simulation"
      >
        <Section title="The Core Argument">
          <p>
            Rose and Miller argue that modern government works by making social life
            measurable and calculable. Collier shows how flood insurance became a mechanism
            for "reframing calculative choice." The governing body doesn't command
            — it <strong>designs the reward function</strong>.
          </p>
        </Section>

        <Section title="Four Policy Levers">
          <p>
            Each lever modifies a specific term in the agent's utility calculation.
            Changing the formula changes behavior — without giving a single direct order.
          </p>
          <Diagram>
            <div className="lever-diagram">
              <div className="lever-card">
                <div className="lever-icon blue">$</div>
                <strong>Insurance Subsidy</strong>
                <Formula>
                  <V color="dim">Cost</V> &times; (1 &minus; <V color="blue">Subsidy</V>)
                </Formula>
                <span className="lever-effect">Reduces insurance cost for agents</span>
              </div>
              <div className="lever-card">
                <div className="lever-icon cyan">i</div>
                <strong>Risk Disclosure</strong>
                <Formula>
                  <V color="cyan">Perceived</V> = <V color="red">Actual Risk</V>
                </Formula>
                <span className="lever-effect">Agents see true flood probability</span>
              </div>
              <div className="lever-card">
                <div className="lever-icon orange">Z</div>
                <strong>Zoning Strictness</strong>
                <Formula>
                  &minus;<V color="orange">Penalty</V> &times; <V color="green">Income</V>
                </Formula>
                <span className="lever-effect">Penalizes high-risk settlement</span>
              </div>
              <div className="lever-card">
                <div className="lever-icon red">R</div>
                <strong>Disaster Relief</strong>
                <Formula>
                  <V color="dim">Loss</V> &times; (1 &minus; <V color="red">Relief</V>)
                </Formula>
                <span className="lever-effect">Government absorbs flood costs</span>
              </div>
            </div>
          </Diagram>
        </Section>

        <Section title="Moral Hazard">
          <p>
            Policy design has unintended consequences. Consider:
          </p>
          <Diagram>
            <div className="hazard-grid">
              <div className="hazard-row">
                <span className="hazard-label">High relief + No subsidy</span>
                <span className="hazard-result red">No one buys insurance — why pay if the government covers losses?</span>
              </div>
              <div className="hazard-row">
                <span className="hazard-label">High subsidy + High relief</span>
                <span className="hazard-result orange">Everyone insured, but at massive public expense</span>
              </div>
              <div className="hazard-row">
                <span className="hazard-label">Disclosure + Low relief</span>
                <span className="hazard-result green">Agents self-sort: informed, responsible, minimal gov cost</span>
              </div>
            </div>
          </Diagram>
          <p>
            The "right" policy depends on values: should the state protect people from risk,
            or ensure they bear the consequences of their own choices?
          </p>
        </Section>

        <Insight>
          You are the governing body. Every slider changes the formula.
          Every formula change reshapes 150 lives. No one is told what to do —
          yet <strong>the design of incentives determines the outcome</strong>.
          This is what it means to govern at a distance.
        </Insight>
      </Explainer>
    );
  }

  // ── Simulate phase ──

  const snap = env.getSnapshot();

  const compData = baseline ? {
    labels: ['In High Risk', 'Insured', 'Avg Wealth'],
    datasets: [
      {
        label: 'Before',
        data: [baseline.agentsInHighRisk, baseline.agentsInsured, baseline.avgWealth],
        backgroundColor: 'rgba(158,158,158,0.5)',
      },
      {
        label: 'After',
        data: [snap.agentsInHighRisk, snap.agentsInsured, snap.avgWealth],
        backgroundColor: 'rgba(66,165,245,0.7)',
      },
    ],
  } : null;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="view-layout">
      <div className="grid-panel">
        <GridCanvas env={env} tick={tick} mode="society" />
        <div className="grid-legend">
          <span className="lg"><span className="dot" style={{ background: '#2d6a3f' }} /> Low risk</span>
          <span className="lg"><span className="dot" style={{ background: '#c8a833' }} /> Medium risk</span>
          <span className="lg"><span className="dot" style={{ background: '#d94f3b' }} /> High risk</span>
          <span className="lg"><span className="dot agent-unins" /> Uninsured</span>
          <span className="lg"><span className="dot agent-ins" /> Insured</span>
        </div>
        <FormulaPanel mode="policy" policy={env.policy} />
      </div>

      <div className="info-panel">
        <h2>Policy Intervention</h2>
        <p className="desc">
          Adjust the levers. No one is told what to do — but everyone responds
          to the incentive structure you design.
        </p>

        <div className="info-block policy-levers">
          <h3>Policy Levers</h3>

          <div className="lever">
            <label>Insurance Subsidy: <strong>{Math.round(p.insuranceSubsidy * 100)}%</strong></label>
            <input type="range" min={0} max={100} value={p.insuranceSubsidy * 100}
              onChange={(e) => update('insuranceSubsidy', +e.target.value / 100)} />
            <p className="lever-desc">Government pays a share of insurance premiums</p>
          </div>

          <div className="lever">
            <label>Risk Disclosure: <strong>{p.disclosure ? 'ON' : 'OFF'}</strong></label>
            <input type="range" min={0} max={1} step={1} value={p.disclosure ? 1 : 0}
              onChange={(e) => update('disclosure', +e.target.value === 1)} />
            <p className="lever-desc">Require public disclosure of flood risk data</p>
          </div>

          <div className="lever">
            <label>Zoning Strictness: <strong>{Math.round(p.zoningStrictness * 100)}%</strong></label>
            <input type="range" min={0} max={100} value={p.zoningStrictness * 100}
              onChange={(e) => update('zoningStrictness', +e.target.value / 100)} />
            <p className="lever-desc">Restrict building in high-risk zones</p>
          </div>

          <div className="lever">
            <label>Disaster Relief: <strong>{Math.round(p.reliefGenerosity * 100)}%</strong></label>
            <input type="range" min={0} max={100} value={p.reliefGenerosity * 100}
              onChange={(e) => update('reliefGenerosity', +e.target.value / 100)} />
            <p className="lever-desc">How much government compensates flood losses</p>
          </div>
        </div>

        <div className="info-block">
          <h3>Society Response</h3>
          <div className="stats">
            <div className="stat"><span>In high-risk zones</span><span>{snap.agentsInHighRisk}</span></div>
            <div className="stat"><span>Insured</span><span>{snap.agentsInsured}</span></div>
            <div className="stat"><span>Avg wealth</span><span>{snap.avgWealth.toFixed(1)}</span></div>
            <div className="stat"><span>Gov spending</span><span>{snap.govSpending.toFixed(0)}</span></div>
          </div>
        </div>

        {compData && (
          <div className="info-block chart-block">
            <h3>Before / After</h3>
            <div className="chart-container">
              <Bar data={compData} options={chartOpts} />
            </div>
          </div>
        )}

        <div className="controls">
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Run Simulation'}
          </button>
          <button className="btn" onClick={reset}>Reset</button>
          <button className="btn danger" onClick={flood}>Trigger Flood</button>
        </div>
      </div>
    </div>
  );
}

function policyNarrative(key: string, val: number | boolean): string {
  switch (key) {
    case 'insuranceSubsidy':
      return val as number > 0.5
        ? 'Heavy insurance subsidies make insurance cheap. Watch agents buy insurance — but at what cost to the public budget?'
        : 'With low subsidies, agents must weigh the full cost of insurance against the risk of going uninsured.';
    case 'disclosure':
      return val
        ? 'Risk disclosure is ON. Agents now see the true flood risk. Watch how information changes settlement patterns.'
        : 'Risk disclosure is OFF. Agents underestimate flood risk — normalcy bias leads them toward danger.';
    case 'zoningStrictness':
      return val as number > 0.5
        ? 'Strict zoning pushes agents away from high-risk zones. Income falls — but so does flood exposure.'
        : 'Relaxed zoning lets agents settle wherever they choose, even in dangerous floodplains.';
    case 'reliefGenerosity':
      return val as number > 0.7
        ? 'Generous disaster relief means the government absorbs flood costs. But why buy insurance if the state will bail you out? This is moral hazard.'
        : 'With limited relief, agents bear the cost of floods themselves — creating a strong incentive to insure or relocate.';
    default:
      return '';
  }
}

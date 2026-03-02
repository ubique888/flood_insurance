import type { Policy } from '../simulation/types';
import {
  BASE_DAMAGE, INSURANCE_LOAD, DEDUCTIBLE_RATE, FLOOD_BASE_PROB,
  RISK_AVERSION_MEAN, RISK_AVERSION_SPREAD,
} from '../simulation/types';

type ViewMode = 'individual' | 'society' | 'policy';

interface Props {
  mode: ViewMode;
  policy: Policy;
  /** For individual view: current agent epsilon */
  epsilon?: number;
}

function N({ v, unit }: { v: number; unit?: string }) {
  return <span className="fp-num">{v}{unit}</span>;
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="fp-lbl">{children}</span>;
}

export default function FormulaPanel({ mode, policy, epsilon }: Props) {
  const sub = policy.insuranceSubsidy;
  const rel = policy.reliefGenerosity;
  const raLo = Math.max(0.5, RISK_AVERSION_MEAN - RISK_AVERSION_SPREAD);
  const raHi = RISK_AVERSION_MEAN + RISK_AVERSION_SPREAD;

  // Break-even risk aversion: INSURANCE_LOAD*(1-sub) + DEDUCTIBLE_RATE = (1-rel) * riskAversion
  const breakEven = (INSURANCE_LOAD * (1 - sub) + DEDUCTIBLE_RATE) / Math.max(0.01, 1 - rel);

  return (
    <div className="formula-panel">
      <h3>Formulas &amp; Parameters</h3>

      {mode === 'individual' && (
        <>
          <div className="fp-section">
            <div className="fp-title">Reward Function</div>
            <div className="fp-formula">
              <span className="fp-var green">Reward</span> = <span className="fp-var green">Income</span> &minus; <span className="fp-var blue">Insurance</span> &minus; <span className="fp-var red">Flood Damage</span> + <span className="fp-var cyan">Relief</span>
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-title">Q-Learning Update</div>
            <div className="fp-formula">
              <span className="fp-var accent">Q(s,a)</span> &larr; <span className="fp-var accent">Q(s,a)</span> + <span className="fp-var dim">&alpha;</span>[<span className="fp-var green">r</span> + <span className="fp-var dim">&gamma;</span>&middot;max<span className="fp-var accent">Q(s',a')</span> &minus; <span className="fp-var accent">Q(s,a)</span>]
            </div>
          </div>

          <div className="fp-params">
            <div className="fp-param"><Lbl>&alpha; (learn rate)</Lbl><N v={0.1} /></div>
            <div className="fp-param"><Lbl>&gamma; (discount)</Lbl><N v={0.95} /></div>
            <div className="fp-param"><Lbl>&epsilon; (explore)</Lbl><N v={Number((epsilon ?? 0.15).toFixed(3))} /></div>
            <div className="fp-param"><Lbl>Flood prob</Lbl><N v={FLOOD_BASE_PROB} /></div>
            <div className="fp-param"><Lbl>Base damage</Lbl><N v={BASE_DAMAGE} /></div>
            <div className="fp-param"><Lbl>Insurance load</Lbl><N v={INSURANCE_LOAD} /></div>
            <div className="fp-param"><Lbl>Deductible</Lbl><N v={DEDUCTIBLE_RATE * 100} unit="%" /></div>
            <div className="fp-param"><Lbl>Relief</Lbl><N v={Math.round(rel * 100)} unit="%" /></div>
          </div>
        </>
      )}

      {mode === 'society' && (
        <>
          <div className="fp-section">
            <div className="fp-title">Agent Utility</div>
            <div className="fp-formula">
              <span className="fp-var green">U(cell)</span> = <span className="fp-var green">Income</span> &minus; min(<span className="fp-var blue">Insured</span>, <span className="fp-var red">Uninsured</span>) &minus; <span className="fp-var orange">Zoning</span>
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-title">Insurance Decision</div>
            <div className="fp-formula small">
              <span className="fp-var blue">Insured</span> = Risk &times; <N v={BASE_DAMAGE}/> &times; <N v={INSURANCE_LOAD}/> + Risk &times; <N v={BASE_DAMAGE}/> &times; <N v={DEDUCTIBLE_RATE}/>
            </div>
            <div className="fp-formula small">
              <span className="fp-var red">Uninsured</span> = Risk &times; <N v={BASE_DAMAGE}/> &times; (1 &minus; <N v={rel}/>) &times; <span className="fp-var dim">RiskAversion</span>
            </div>
          </div>

          <div className="fp-params">
            <div className="fp-param"><Lbl>Flood prob</Lbl><N v={FLOOD_BASE_PROB} /></div>
            <div className="fp-param"><Lbl>Base damage</Lbl><N v={BASE_DAMAGE} /></div>
            <div className="fp-param"><Lbl>Insurance load</Lbl><N v={INSURANCE_LOAD} /></div>
            <div className="fp-param"><Lbl>Deductible</Lbl><N v={DEDUCTIBLE_RATE * 100} unit="%" /></div>
            <div className="fp-param"><Lbl>Risk aversion</Lbl><N v={raLo} />&ndash;<N v={raHi} /></div>
            <div className="fp-param"><Lbl>Disclosure</Lbl>{policy.disclosure ? 'ON' : 'OFF'}</div>
          </div>
        </>
      )}

      {mode === 'policy' && (
        <>
          <div className="fp-section">
            <div className="fp-title">Insurance Break-Even</div>
            <div className="fp-formula small">
              Agents insure when <span className="fp-var dim">RiskAversion</span> &gt; <span className="fp-var accent">{breakEven.toFixed(2)}</span>
            </div>
            <div className="fp-formula small">
              Range: <N v={raLo} />&ndash;<N v={raHi} /> &rarr; ~<span className="fp-var accent">{Math.round(Math.max(0, Math.min(100, (raHi - breakEven) / (raHi - raLo) * 100)))}%</span> insure
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-title">Policy Effects on Formula</div>
            <div className="fp-formula small">
              <span className="fp-var blue">Premium</span> = Risk &times; <N v={BASE_DAMAGE}/> &times; <N v={INSURANCE_LOAD}/> &times; (1 &minus; <span className="fp-var blue">{sub.toFixed(2)}</span>)
            </div>
            <div className="fp-formula small">
              <span className="fp-var red">Uninsured Loss</span> = Risk &times; <N v={BASE_DAMAGE}/> &times; (1 &minus; <span className="fp-var red">{rel.toFixed(2)}</span>) &times; <span className="fp-var dim">RA</span>
            </div>
            <div className="fp-formula small">
              <span className="fp-var orange">Zoning</span> = <span className="fp-var orange">{policy.zoningStrictness.toFixed(2)}</span> &times; Income &times; 0.8
              <span className="fp-cond">if risk &gt; {0.6}</span>
            </div>
          </div>

          <div className="fp-params">
            <div className="fp-param"><Lbl>Subsidy</Lbl><N v={Math.round(sub * 100)} unit="%" /></div>
            <div className="fp-param"><Lbl>Relief</Lbl><N v={Math.round(rel * 100)} unit="%" /></div>
            <div className="fp-param"><Lbl>Zoning</Lbl><N v={Math.round(policy.zoningStrictness * 100)} unit="%" /></div>
            <div className="fp-param"><Lbl>Disclosure</Lbl>{policy.disclosure ? 'ON' : 'OFF'}</div>
            <div className="fp-param"><Lbl>Break-even RA</Lbl><N v={Number(breakEven.toFixed(2))} /></div>
            <div className="fp-param"><Lbl>Flood prob</Lbl><N v={FLOOD_BASE_PROB} /></div>
          </div>
        </>
      )}
    </div>
  );
}

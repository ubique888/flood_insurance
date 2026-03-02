import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle: string;
  onStart: () => void;
  buttonLabel?: string;
  children: ReactNode;
}

export default function Explainer({
  title,
  subtitle,
  onStart,
  buttonLabel = 'Start Simulation',
  children,
}: Props) {
  return (
    <div className="explainer">
      <div className="explainer-header">
        <h2>{title}</h2>
        <p className="explainer-subtitle">{subtitle}</p>
      </div>

      <div className="explainer-body">
        {children}
      </div>

      <button className="explainer-start" onClick={onStart}>
        {buttonLabel}
      </button>
    </div>
  );
}

/* ── Reusable sub-components for formula rendering ── */

export function Formula({ children }: { children: ReactNode }) {
  return <div className="formula">{children}</div>;
}

export function V({ color, children }: { color: string; children: ReactNode }) {
  return <span className={`fvar ${color}`}>{children}</span>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="explainer-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Insight({ children }: { children: ReactNode }) {
  return (
    <div className="explainer-insight">
      <span className="insight-label">Key Insight</span>
      <p>{children}</p>
    </div>
  );
}

export function Diagram({ children }: { children: ReactNode }) {
  return <div className="explainer-diagram">{children}</div>;
}

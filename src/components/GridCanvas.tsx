import { useRef, useEffect } from 'react';
import { FloodplainEnvironment } from '../simulation/environment';
import { QLearningAgent } from '../simulation/agent';
import type { AgentData } from '../simulation/types';
import {
  GRID_WIDTH, GRID_HEIGHT, CELL_SIZE,
  DIRECTIONS, DIR_OFFSETS,
  FLOOD_DISPLAY_TICKS,
} from '../simulation/types';

// ── Colour helpers ───────────────────────────────────────

function riskColor(risk: number): string {
  if (risk >= 1) return '#1565c0'; // water
  // green → yellow → red
  const r = Math.round(45 + risk * 200);
  const g = Math.round(160 - risk * 100);
  const b = Math.round(63 - risk * 30);
  return `rgb(${r},${g},${Math.max(0, b)})`;
}

function incomeOverlay(income: number): string {
  return `rgba(255,255,255,${income * 0.15})`;
}

// ── Draw functions ───────────────────────────────────────

function drawCells(ctx: CanvasRenderingContext2D, env: FloodplainEnvironment) {
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const c = env.grid[x][y];
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      // Base colour by risk
      ctx.fillStyle = riskColor(c.floodRisk);
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

      // Flood overlay — uses recentFloodMap for persistence with fading
      const floodTicks = env.recentFloodMap[x][y];
      if (floodTicks > 0) {
        const alpha = (floodTicks / FLOOD_DISPLAY_TICKS) * 0.55;
        ctx.fillStyle = `rgba(66,165,245,${alpha})`;
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      } else if (!c.isWater) {
        // Subtle income brightness overlay (only when not showing flood)
        ctx.fillStyle = incomeOverlay(c.income);
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
    }
  }
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  a: AgentData,
  highlight: boolean,
) {
  const cx = a.x * CELL_SIZE + CELL_SIZE / 2;
  const cy = a.y * CELL_SIZE + CELL_SIZE / 2;
  const r = highlight ? CELL_SIZE * 0.4 : CELL_SIZE * 0.28;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = a.insured ? '#42a5f5' : '#ff7043';
  ctx.fill();
  if (highlight) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

function drawQArrows(
  ctx: CanvasRenderingContext2D,
  agent: QLearningAgent,
) {
  const d = agent.data;
  const qv = agent.getQValues(d.x, d.y, d.insured);

  // Find max Q for normalisation
  let maxQ = -Infinity, minQ = Infinity;
  for (let i = 0; i < 5; i++) {
    // Merge insurance choices: take best Q for each direction
    const best = Math.max(qv[i], qv[i + 5]);
    if (best > maxQ) maxQ = best;
    if (best < minQ) minQ = best;
  }
  const range = maxQ - minQ || 1;

  const cx = d.x * CELL_SIZE + CELL_SIZE / 2;
  const cy = d.y * CELL_SIZE + CELL_SIZE / 2;

  for (let i = 0; i < 5; i++) {
    const dir = DIRECTIONS[i];
    if (dir === 'stay') continue;
    const [dx, dy] = DIR_OFFSETS[dir];
    const best = Math.max(qv[i], qv[i + 5]);
    const norm = (best - minQ) / range; // 0–1

    const len = CELL_SIZE * 0.6 * (0.3 + norm * 0.7);
    const ex = cx + dx * len;
    const ey = cy + dy * len;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.lineWidth = 1 + norm * 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + norm * 0.7})`;
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 4 + norm * 3;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - headLen * Math.cos(angle - 0.5),
      ey - headLen * Math.sin(angle - 0.5),
    );
    ctx.lineTo(
      ex - headLen * Math.cos(angle + 0.5),
      ey - headLen * Math.sin(angle + 0.5),
    );
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${0.3 + norm * 0.7})`;
    ctx.fill();
  }
}

// ── Component ────────────────────────────────────────────

interface Props {
  env: FloodplainEnvironment;
  tick: number;                       // triggers re-draw
  mode: 'individual' | 'society';
  showQValues?: boolean;
}

export default function GridCanvas({ env, tick, mode, showQValues }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Cells
    drawCells(ctx, env);

    // Agents
    if (mode === 'individual' && env.individualAgent) {
      drawAgent(ctx, env.individualAgent.data, true);
      if (showQValues) drawQArrows(ctx, env.individualAgent);
    } else {
      for (const ag of env.societyAgents) {
        drawAgent(ctx, ag.data, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, env, mode, showQValues]);

  return (
    <canvas
      ref={ref}
      width={GRID_WIDTH * CELL_SIZE}
      height={GRID_HEIGHT * CELL_SIZE}
      className="grid-canvas"
    />
  );
}

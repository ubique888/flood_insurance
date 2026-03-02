import type { Cell, Policy, AgentData, StepResult, SimSnapshot } from './types';
import {
  DEFAULT_POLICY,
  GRID_WIDTH, GRID_HEIGHT, DIR_OFFSETS,
  BASE_DAMAGE, INSURANCE_LOAD, DEDUCTIBLE_RATE, FLOOD_BASE_PROB, HIGH_RISK_THRESHOLD,
  FLOOD_DISPLAY_TICKS,
  RISK_AVERSION_MEAN, RISK_AVERSION_SPREAD,
} from './types';
import { generateGrid, getRiskLevel } from './grid';
import { QLearningAgent, UtilityAgent } from './agent';

export class FloodplainEnvironment {
  grid: Cell[][];
  policy: Policy;
  stepCount = 0;
  floodEvents = 0;
  govSpending = 0;

  // Flood display persistence (cosmetic only — damage is applied once)
  recentFloodMap: number[][];

  // Individual mode
  individualAgent: QLearningAgent | null = null;

  // Society mode
  societyAgents: UtilityAgent[] = [];

  constructor(policy?: Policy) {
    this.grid = generateGrid();
    this.policy = policy ? { ...policy } : { ...DEFAULT_POLICY };
    this.recentFloodMap = this.makeFloodMap();
  }

  private makeFloodMap(): number[][] {
    return Array.from({ length: GRID_WIDTH }, () => new Array<number>(GRID_HEIGHT).fill(0));
  }

  // ── Helpers ──────────────────────────────────────────────

  isValid(x: number, y: number): boolean {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT && !this.grid[x][y].isWater;
  }

  clearFloods(): void {
    for (let x = 0; x < GRID_WIDTH; x++)
      for (let y = 0; y < GRID_HEIGHT; y++)
        this.grid[x][y].isFlooded = false;
  }

  /** Decrement all flood display timers each tick. */
  private tickFloodDisplay(): void {
    for (let x = 0; x < GRID_WIDTH; x++)
      for (let y = 0; y < GRID_HEIGHT; y++)
        if (this.recentFloodMap[x][y] > 0) this.recentFloodMap[x][y]--;
  }

  triggerFlood(severity?: number): void {
    const sev = severity ?? (0.2 + Math.random() * 0.8);
    this.floodEvents++;
    const threshold = 1 - sev;
    for (let x = 0; x < GRID_WIDTH; x++)
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const c = this.grid[x][y];
        if (c.floodRisk > threshold) {
          c.isFlooded = true;
          this.recentFloodMap[x][y] = FLOOD_DISPLAY_TICKS;
        }
      }
  }

  // ── Reward calculation ──────────────────────────────────

  calcStep(agent: AgentData, cell: Cell): StepResult {
    const income = cell.income * 10;

    // Premium: per-step cost scaled by actual flood probability
    let insuranceCost = 0;
    if (agent.insured) {
      insuranceCost =
        FLOOD_BASE_PROB * cell.floodRisk * BASE_DAMAGE * INSURANCE_LOAD
        * (1 - this.policy.insuranceSubsidy);
    }

    let zoningPenalty = 0;
    if (cell.floodRisk > HIGH_RISK_THRESHOLD) {
      zoningPenalty = this.policy.zoningStrictness * income * 0.5;
    }

    let floodDamage = 0;
    let reliefPayment = 0;
    const wasFlooded = cell.isFlooded;

    if (wasFlooded) {
      floodDamage = agent.insured ? BASE_DAMAGE * DEDUCTIBLE_RATE : BASE_DAMAGE;
      reliefPayment = floodDamage * this.policy.reliefGenerosity;
      floodDamage -= reliefPayment;
    }

    // Track government cost
    const subsidyCost = agent.insured
      ? FLOOD_BASE_PROB * cell.floodRisk * BASE_DAMAGE * INSURANCE_LOAD
        * this.policy.insuranceSubsidy
      : 0;
    this.govSpending += subsidyCost + reliefPayment;

    return {
      reward: income - insuranceCost - floodDamage - zoningPenalty,
      income,
      insuranceCost,
      floodDamage,
      reliefPayment,
      wasFlooded,
      zoningPenalty,
    };
  }

  // ── Individual mode ─────────────────────────────────────

  initIndividual(): void {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * GRID_WIDTH);
      y = Math.floor(Math.random() * GRID_HEIGHT);
    } while (!this.isValid(x, y));

    this.individualAgent = new QLearningAgent({
      id: 0, x, y,
      wealth: 100,
      insured: false,
      riskAversion: RISK_AVERSION_MEAN,
      perceivedRisk: new Map(),
      lastReward: 0,
      lastStepResult: null,
      wealthHistory: [100],
    });
  }

  stepIndividual(): StepResult | null {
    const ag = this.individualAgent;
    if (!ag) return null;
    const d = ag.data;
    const oldX = d.x, oldY = d.y, oldIns = d.insured;

    // Choose action
    const act = ag.chooseAction();

    // Move
    const [dx, dy] = DIR_OFFSETS[act.direction];
    const nx = d.x + dx, ny = d.y + dy;
    if (this.isValid(nx, ny)) {
      const target = this.grid[nx][ny];
      const blocked =
        target.floodRisk > HIGH_RISK_THRESHOLD && Math.random() < this.policy.zoningStrictness;
      if (!blocked) { d.x = nx; d.y = ny; }
    }

    d.insured = act.buyInsurance;

    // Flood: clear damage flags, maybe trigger new flood
    this.clearFloods();
    if (Math.random() < FLOOD_BASE_PROB) this.triggerFlood();

    // Tick flood display persistence
    this.tickFloodDisplay();

    // Reward
    const cell = this.grid[d.x][d.y];
    const res = this.calcStep(d, cell);

    d.wealth += res.reward;
    d.lastReward = res.reward;
    d.lastStepResult = res;
    d.wealthHistory.push(d.wealth);

    // Learn
    ag.update(oldX, oldY, oldIns, act.actionIndex, res.reward, d.x, d.y, d.insured);
    ag.epsilon = Math.max(0.02, ag.epsilon * 0.9995);

    this.stepCount++;
    return res;
  }

  // ── Society mode ────────────────────────────────────────

  initSociety(n = 150): void {
    this.societyAgents = [];
    for (let i = 0; i < n; i++) {
      let x: number, y: number;
      do {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
      } while (!this.isValid(x, y));

      const ra = RISK_AVERSION_MEAN - RISK_AVERSION_SPREAD + Math.random() * RISK_AVERSION_SPREAD * 2;
      this.societyAgents.push(
        new UtilityAgent(
          {
            id: i, x, y,
            wealth: 80 + Math.random() * 40,
            insured: false,
            riskAversion: Math.max(0.5, ra),
            perceivedRisk: new Map(),
            lastReward: 0,
            lastStepResult: null,
            wealthHistory: [],
          },
          0.1 + Math.random() * 0.2,
        ),
      );
    }
  }

  stepSociety(): void {
    this.clearFloods();
    if (Math.random() < FLOOD_BASE_PROB) this.triggerFlood();

    // Tick flood display persistence
    this.tickFloodDisplay();

    for (const ag of this.societyAgents) {
      const d = ag.data;
      const cell = this.grid[d.x][d.y];

      d.insured = ag.decideInsurance(cell, this.policy);

      const dir = ag.chooseMoveDirection(this.grid, this.policy);
      const [dx, dy] = DIR_OFFSETS[dir];
      const nx = d.x + dx, ny = d.y + dy;
      if (this.isValid(nx, ny)) { d.x = nx; d.y = ny; }

      const newCell = this.grid[d.x][d.y];
      const res = this.calcStep(d, newCell);

      d.wealth += res.reward;
      d.lastReward = res.reward;
      d.lastStepResult = res;

      ag.updatePerception(newCell, res.wasFlooded);
    }

    this.stepCount++;
  }

  // ── Snapshot ────────────────────────────────────────────

  getSnapshot(): SimSnapshot {
    const agents =
      this.societyAgents.length > 0
        ? this.societyAgents.map((a) => a.data)
        : this.individualAgent
          ? [this.individualAgent.data]
          : [];

    const total = agents.length;
    let inHigh = 0, ins = 0, tw = 0;
    const dist: [number, number, number] = [0, 0, 0];

    for (const a of agents) {
      const r = this.grid[a.x][a.y].floodRisk;
      if (r > HIGH_RISK_THRESHOLD) inHigh++;
      if (a.insured) ins++;
      tw += a.wealth;
      dist[getRiskLevel(r)]++;
    }

    return {
      step: this.stepCount,
      totalAgents: total,
      agentsInHighRisk: inHigh,
      agentsInsured: ins,
      avgWealth: total > 0 ? tw / total : 0,
      govSpending: this.govSpending,
      floodEvents: this.floodEvents,
      distributionByRisk: dist,
    };
  }

  reset(): void {
    this.grid = generateGrid();
    this.stepCount = 0;
    this.floodEvents = 0;
    this.govSpending = 0;
    this.individualAgent = null;
    this.societyAgents = [];
    this.recentFloodMap = this.makeFloodMap();
  }
}

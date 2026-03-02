// === Grid Constants ===
export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 20;
export const CELL_SIZE = 24;

// === Risk Thresholds ===
export const LOW_RISK_THRESHOLD = 0.3;
export const HIGH_RISK_THRESHOLD = 0.6;

// === Economic Constants ===
export const BASE_DAMAGE = 50;
export const INSURANCE_LOAD = 1.3;
export const DEDUCTIBLE_RATE = 0.1;
export const FLOOD_BASE_PROB = 0.04;
export const RISK_AVERSION_MEAN = 2.0;  // centre of per-agent risk aversion distribution
export const RISK_AVERSION_SPREAD = 1.0; // half-width: agents range [MEAN-SPREAD, MEAN+SPREAD]
export const FLOOD_DISPLAY_TICKS = 8;   // how many ticks flood overlay persists

// === Data Structures ===

export interface Cell {
  x: number;
  y: number;
  elevation: number;
  floodRisk: number;
  income: number;
  isWater: boolean;
  isFlooded: boolean;
}

export interface Policy {
  insuranceSubsidy: number;    // 0–1: fraction of premium paid by government
  disclosure: boolean;         // whether agents see true flood risk
  zoningStrictness: number;    // 0–1: how much high-risk zones are restricted
  reliefGenerosity: number;    // 0–1: fraction of flood damage compensated
}

export const DEFAULT_POLICY: Policy = {
  insuranceSubsidy: 0,
  disclosure: false,
  zoningStrictness: 0,
  reliefGenerosity: 0.3,
};

export interface AgentData {
  id: number;
  x: number;
  y: number;
  wealth: number;
  insured: boolean;
  riskAversion: number;                 // per-agent: how much they overweight uncertain losses
  perceivedRisk: Map<string, number>;
  lastReward: number;
  lastStepResult: StepResult | null;
  wealthHistory: number[];
}

export interface StepResult {
  reward: number;
  income: number;
  insuranceCost: number;
  floodDamage: number;
  reliefPayment: number;
  wasFlooded: boolean;
  zoningPenalty: number;
}

export interface SimSnapshot {
  step: number;
  totalAgents: number;
  agentsInHighRisk: number;
  agentsInsured: number;
  avgWealth: number;
  govSpending: number;
  floodEvents: number;
  distributionByRisk: [number, number, number]; // [low, med, high]
}

// === Movement ===

export type Direction = 'N' | 'S' | 'E' | 'W' | 'stay';

export const DIRECTIONS: Direction[] = ['N', 'S', 'E', 'W', 'stay'];

export const DIR_OFFSETS: Record<Direction, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
  stay: [0, 0],
};

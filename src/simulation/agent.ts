import type { AgentData, Cell, Direction, Policy } from './types';
import {
  DIRECTIONS, DIR_OFFSETS,
  GRID_WIDTH, GRID_HEIGHT,
  BASE_DAMAGE, INSURANCE_LOAD, DEDUCTIBLE_RATE, HIGH_RISK_THRESHOLD,
  FLOOD_BASE_PROB,
} from './types';

// ============================================================
// Fine-grained Q-Learning Agent  (used in Individual View)
// ============================================================

export class QLearningAgent {
  static readonly NUM_ACTIONS = 10; // 5 directions × 2 insurance choices

  qTable: Float32Array;
  epsilon: number;
  alpha: number;
  gamma: number;
  data: AgentData;

  constructor(data: AgentData, epsilon = 0.15, alpha = 0.1, gamma = 0.95) {
    this.data = data;
    this.epsilon = epsilon;
    this.alpha = alpha;
    this.gamma = gamma;
    const size = GRID_WIDTH * GRID_HEIGHT * 2 * QLearningAgent.NUM_ACTIONS;
    this.qTable = new Float32Array(size);
  }

  private idx(x: number, y: number, insured: boolean): number {
    return ((x * GRID_HEIGHT + y) * 2 + (insured ? 1 : 0)) * QLearningAgent.NUM_ACTIONS;
  }

  /** Return the 10-element Q-value slice for a state. */
  getQValues(x: number, y: number, insured: boolean): Float32Array {
    const i = this.idx(x, y, insured);
    return this.qTable.subarray(i, i + QLearningAgent.NUM_ACTIONS);
  }

  chooseAction(): { direction: Direction; buyInsurance: boolean; actionIndex: number } {
    const qv = this.getQValues(this.data.x, this.data.y, this.data.insured);

    let ai: number;
    if (Math.random() < this.epsilon) {
      ai = Math.floor(Math.random() * QLearningAgent.NUM_ACTIONS);
    } else {
      ai = 0;
      for (let i = 1; i < QLearningAgent.NUM_ACTIONS; i++) {
        if (qv[i] > qv[ai]) ai = i;
      }
    }

    return {
      direction: DIRECTIONS[ai % 5],
      buyInsurance: ai >= 5,
      actionIndex: ai,
    };
  }

  update(
    oldX: number, oldY: number, oldInsured: boolean,
    actionIndex: number, reward: number,
    newX: number, newY: number, newInsured: boolean,
  ): void {
    const oldI = this.idx(oldX, oldY, oldInsured) + actionIndex;
    const nqv = this.getQValues(newX, newY, newInsured);
    let maxNext = nqv[0];
    for (let i = 1; i < QLearningAgent.NUM_ACTIONS; i++) {
      if (nqv[i] > maxNext) maxNext = nqv[i];
    }
    this.qTable[oldI] += this.alpha * (reward + this.gamma * maxNext - this.qTable[oldI]);
  }
}

// ============================================================
// Utility-based Agent  (used in Society / Policy Views)
// ============================================================

export class UtilityAgent {
  data: AgentData;
  explorationNoise: number;

  constructor(data: AgentData, explorationNoise = 0.15) {
    this.data = data;
    this.explorationNoise = explorationNoise;
  }

  // --- Risk perception ---

  getPerceivedRisk(cell: Cell, policy: Policy): number {
    if (policy.disclosure) return cell.floodRisk;

    const key = `${cell.x},${cell.y}`;
    if (!this.data.perceivedRisk.has(key)) {
      // Agents underestimate risk when there's no disclosure
      this.data.perceivedRisk.set(key, cell.floodRisk * (0.3 + Math.random() * 0.5));
    }
    return this.data.perceivedRisk.get(key)!;
  }

  updatePerception(cell: Cell, wasFlooded: boolean): void {
    const key = `${cell.x},${cell.y}`;
    const cur = this.data.perceivedRisk.get(key) ?? cell.floodRisk * 0.3;
    if (wasFlooded) {
      this.data.perceivedRisk.set(key, Math.min(1, cur + 0.3));
    } else {
      this.data.perceivedRisk.set(key, cur * 0.98);
    }
  }

  // --- Utility evaluation ---

  evaluateCell(cell: Cell, policy: Policy): number {
    if (cell.isWater) return -Infinity;

    const risk = this.getPerceivedRisk(cell, policy);
    const income = cell.income;

    const zoningPenalty = cell.floodRisk > HIGH_RISK_THRESHOLD
      ? policy.zoningStrictness * income * 0.8
      : 0;

    // Scale by actual per-step flood probability
    const actualRisk = FLOOD_BASE_PROB * risk;
    const premium = actualRisk * BASE_DAMAGE * INSURANCE_LOAD * (1 - policy.insuranceSubsidy);
    const insuredCost = premium + actualRisk * BASE_DAMAGE * DEDUCTIBLE_RATE;
    // Risk aversion: agents overweight uncertain catastrophic losses
    const uninsuredCost = actualRisk * BASE_DAMAGE * (1 - policy.reliefGenerosity) * this.data.riskAversion;
    const bestCost = Math.min(insuredCost, uninsuredCost);

    return income - bestCost - zoningPenalty + (Math.random() - 0.5) * this.explorationNoise;
  }

  // --- Insurance decision ---

  decideInsurance(cell: Cell, policy: Policy): boolean {
    const risk = this.getPerceivedRisk(cell, policy);
    const actualRisk = FLOOD_BASE_PROB * risk;
    const premium = actualRisk * BASE_DAMAGE * INSURANCE_LOAD * (1 - policy.insuranceSubsidy);
    const insuredLoss = premium + actualRisk * BASE_DAMAGE * DEDUCTIBLE_RATE;
    const uninsuredLoss = actualRisk * BASE_DAMAGE * (1 - policy.reliefGenerosity) * this.data.riskAversion;
    return insuredLoss < uninsuredLoss;
  }

  // --- Movement ---

  chooseMoveDirection(grid: Cell[][], policy: Policy): Direction {
    const { x, y } = this.data;
    let bestDir: Direction = 'stay';
    let bestUtil = this.evaluateCell(grid[x][y], policy);

    for (const dir of DIRECTIONS) {
      if (dir === 'stay') continue;
      const [dx, dy] = DIR_OFFSETS[dir];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;

      const cell = grid[nx][ny];
      if (cell.floodRisk > HIGH_RISK_THRESHOLD && Math.random() < policy.zoningStrictness) continue;

      const util = this.evaluateCell(cell, policy);
      if (util > bestUtil) {
        bestUtil = util;
        bestDir = dir;
      }
    }
    return bestDir;
  }
}

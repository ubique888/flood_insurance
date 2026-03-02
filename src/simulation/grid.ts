import type { Cell } from './types';
import { GRID_WIDTH, GRID_HEIGHT, LOW_RISK_THRESHOLD, HIGH_RISK_THRESHOLD } from './types';

/**
 * Generate a floodplain landscape with a winding river.
 * Key tension: high-income land is near the river (fertile floodplain)
 * but also has the highest flood risk.
 */
export function generateGrid(): Cell[][] {
  const grid: Cell[][] = [];

  // --- River path: winding from left to right ---
  const riverPath: number[] = [];
  let ry = GRID_HEIGHT / 2;
  for (let x = 0; x < GRID_WIDTH; x++) {
    ry += (Math.random() - 0.5) * 1.5;
    ry = Math.max(3, Math.min(GRID_HEIGHT - 4, ry));
    riverPath.push(ry);
  }
  // Smooth the path
  for (let pass = 0; pass < 4; pass++) {
    for (let x = 1; x < GRID_WIDTH - 1; x++) {
      riverPath[x] = (riverPath[x - 1] + riverPath[x] + riverPath[x + 1]) / 3;
    }
  }

  // --- Build cells ---
  for (let x = 0; x < GRID_WIDTH; x++) {
    grid[x] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const distToRiver = Math.abs(y - riverPath[x]);
      const isWater = distToRiver < 0.8;

      // Flood risk: exponential decay from river
      const floodRisk = isWater
        ? 1.0
        : Math.min(1, Math.max(0, 0.95 * Math.exp(-distToRiver * 0.35)));

      // Income: fertile floodplain near river, poorer upland
      const baseIncome = isWater
        ? 0
        : Math.max(0.15, 0.85 * Math.exp(-distToRiver * 0.22) + (Math.random() * 0.1));

      // Elevation: increases with distance from river
      const elevation = Math.min(1, distToRiver / (GRID_HEIGHT / 2));

      grid[x][y] = {
        x,
        y,
        elevation,
        floodRisk: isWater ? 1.0 : floodRisk,
        income: isWater ? 0 : Math.min(1, baseIncome),
        isWater,
        isFlooded: false,
      };
    }
  }

  return grid;
}

/** Classify a risk value into low (0), medium (1), or high (2). */
export function getRiskLevel(risk: number): 0 | 1 | 2 {
  if (risk < LOW_RISK_THRESHOLD) return 0;
  if (risk < HIGH_RISK_THRESHOLD) return 1;
  return 2;
}

export interface IslandPlot {
  id: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
}

export const ISLAND_PLOTS: IslandPlot[] = [
  { id: "plot-1", x: 29, y: 58, scale: 1, zIndex: 58 },
  { id: "plot-2", x: 44, y: 52, scale: 0.96, zIndex: 52 },
  { id: "plot-3", x: 58, y: 59, scale: 1.04, zIndex: 59 },
  { id: "plot-4", x: 72, y: 53, scale: 0.98, zIndex: 53 },
];

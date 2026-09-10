import data from "./data/assumptions.json";
import type { AssumptionSet } from "./types";

export const ASSUMPTIONS = data as AssumptionSet[];
export function getAssumption(id: string): AssumptionSet {
  const a = ASSUMPTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`assumption set ${id} not found`);
  return a;
}

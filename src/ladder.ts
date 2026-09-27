// Pure data + maths for the ladder. No DOM here, so it can be unit tested.

export type Look = {
  skin: string;
  hair: string;
  beard: "none" | "short" | "full" | "long";
  beardColor: string;
  outfit: string;
  headwear: "none" | "ghutra";
};

export type Milestone = {
  amount: number;
  name: string;
  note: string;
  kind: "person" | "flag" | "goal";
  color?: string;
  look?: Look;
};

export type Ladder = {
  currency: string;
  current: number;
  goal: number;
  scaleMax: number;
  you: { name: string; look: Look };
  milestones: Milestone[];
  settings: { alwaysOnTop: boolean };
};

export const DEFAULT_LOOK: Look = {
  skin: "#c68a5e",
  hair: "#1c1410",
  beard: "short",
  beardColor: "#1c1410",
  outfit: "#f5f2ea",
  headwear: "none",
};

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function parseLadder(text: string): Ladder {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`ladder.json is not valid JSON: ${(e as Error).message}`);
  }
  const milestones: Milestone[] = (Array.isArray(raw.milestones) ? raw.milestones : [])
    .filter((m: any) => m && typeof m.amount === "number")
    .map((m: any) => ({
      amount: m.amount,
      name: String(m.name ?? ""),
      note: String(m.note ?? ""),
      kind: m.kind === "person" || m.kind === "goal" ? m.kind : "flag",
      color: typeof m.color === "string" ? m.color : undefined,
      look: m.look ? { ...DEFAULT_LOOK, ...m.look } : undefined,
    }))
    .sort((a: Milestone, b: Milestone) => a.amount - b.amount);

  const goal = num(raw.goal, 10000);
  const highest = milestones.length ? milestones[milestones.length - 1].amount : 0;
  return {
    currency: typeof raw.currency === "string" ? raw.currency : "AED",
    current: Math.max(0, num(raw.current, 0)),
    goal,
    scaleMax: Math.max(num(raw.scaleMax, goal), goal, highest),
    you: {
      name: String(raw.you?.name ?? "You"),
      look: { ...DEFAULT_LOOK, ...(raw.you?.look ?? {}) },
    },
    milestones,
    settings: { alwaysOnTop: raw.settings?.alwaysOnTop === true },
  };
}

/** Where an amount sits on the bar, 0..1. */
export function position(amount: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0;
  return Math.min(1, Math.max(0, amount / scaleMax));
}

export function goalPercent(current: number, goal: number): number {
  return goal > 0 ? Math.floor((current / goal) * 100) : 0;
}

export function nextMilestone(current: number, milestones: Milestone[]): Milestone | undefined {
  return [...milestones].sort((a, b) => a.amount - b.amount).find((m) => m.amount > current);
}

/** Milestones passed when the amount moves from `prev` up to `next`. */
export function crossedMilestones(prev: number, next: number, milestones: Milestone[]): Milestone[] {
  if (next <= prev) return [];
  return milestones.filter((m) => m.amount > prev && m.amount <= next);
}

export function formatAmount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function shortAmount(n: number): string {
  return n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n);
}

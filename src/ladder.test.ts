import { describe, expect, it } from "vitest";
import {
  crossedMilestones,
  goalPercent,
  nextMilestone,
  parseLadder,
  position,
  type Milestone,
} from "./ladder";

const ms = (amount: number, name = String(amount)): Milestone => ({
  amount,
  name,
  note: "",
  kind: "flag",
});

describe("position", () => {
  it("maps an amount onto 0..1 of the scale", () => {
    expect(position(0, 15000)).toBe(0);
    expect(position(7500, 15000)).toBe(0.5);
    expect(position(15000, 15000)).toBe(1);
  });
  it("clamps outside the scale", () => {
    expect(position(-50, 15000)).toBe(0);
    expect(position(20000, 15000)).toBe(1);
  });
});

describe("goalPercent", () => {
  it("rounds down so 99.9% never shows as 100%", () => {
    expect(goalPercent(2800, 10000)).toBe(28);
    expect(goalPercent(9999, 10000)).toBe(99);
  });
  it("can go past 100 once the goal is beaten", () => {
    expect(goalPercent(15000, 10000)).toBe(150);
  });
});

describe("nextMilestone", () => {
  const list = [ms(5000), ms(3000), ms(10000)];
  it("returns the closest milestone above the current amount", () => {
    expect(nextMilestone(2800, list)?.amount).toBe(3000);
    expect(nextMilestone(3000, list)?.amount).toBe(5000);
  });
  it("returns undefined when everything is reached", () => {
    expect(nextMilestone(10000, list)).toBeUndefined();
  });
});

describe("crossedMilestones", () => {
  const list = [ms(3000), ms(5000), ms(7000)];
  it("lists milestones passed going up, inclusive of landing on one", () => {
    expect(crossedMilestones(2800, 5000, list).map((m) => m.amount)).toEqual([3000, 5000]);
  });
  it("is empty when going down or staying still", () => {
    expect(crossedMilestones(5000, 2800, list)).toEqual([]);
    expect(crossedMilestones(3000, 3000, list)).toEqual([]);
  });
});

describe("parseLadder", () => {
  it("fills defaults for missing fields and sorts milestones", () => {
    const l = parseLadder(JSON.stringify({ current: 100, milestones: [ms(9000), ms(3000)] }));
    expect(l.currency).toBe("AED");
    expect(l.goal).toBe(10000);
    expect(l.scaleMax).toBe(10000);
    expect(l.milestones.map((m) => m.amount)).toEqual([3000, 9000]);
    expect(l.settings.alwaysOnTop).toBe(false);
  });
  it("stretches the scale to cover the highest milestone", () => {
    const l = parseLadder(JSON.stringify({ goal: 10000, scaleMax: 5000, milestones: [ms(15000)] }));
    expect(l.scaleMax).toBe(15000);
  });
  it("throws a readable error on broken JSON", () => {
    expect(() => parseLadder("{ nope")).toThrow(/ladder\.json/);
  });
});

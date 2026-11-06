import { describe, expect, it } from "vitest";
import { pointsToEarn, type PointsSettings } from "./points";
import {
  activeBonus,
  earnBonusPercent,
  expiryPicture,
  nextTier,
  parseBonusForm,
  parseExpiryDays,
  parseTierForm,
  tierFor,
  type PointsBonus,
  type PointsTier,
} from "./points-v2";

const settings: PointsSettings = { enabled: true, earnPer: 10000, pointValue: 100, maxPercent: 50 };
const bonus = (over: Partial<PointsBonus> = {}): PointsBonus => ({
  id: "b",
  name: "Weekend",
  bonusPercent: 100,
  startsAt: "2026-11-14T00:00:00Z",
  endsAt: "2026-11-16T00:00:00Z",
  active: true,
  ...over,
});
const tier = (name: string, minSpend: number, bonusPercent: number): PointsTier => ({
  id: name,
  name,
  minSpend,
  bonusPercent,
});

describe("pointsToEarn with a bonus", () => {
  it("is unchanged with no bonus (Rs 100 per point)", () => {
    expect(pointsToEarn(1_050_000, settings)).toBe(105);
    expect(pointsToEarn(1_050_000, { ...settings, bonusPercent: 0 })).toBe(105);
  });
  it("doubles at 100 percent and never rounds up", () => {
    expect(pointsToEarn(1_050_000, { ...settings, bonusPercent: 100 })).toBe(210);
    expect(pointsToEarn(1_050_000, { ...settings, bonusPercent: 50 })).toBe(157); // 157.5 rounds down
    expect(pointsToEarn(19_999, { ...settings, bonusPercent: 10 })).toBe(2); // 2.19989 rounds down
  });
  it("ignores a junk bonus and stays off when points are off", () => {
    expect(pointsToEarn(1_050_000, { ...settings, bonusPercent: -50 })).toBe(105);
    expect(pointsToEarn(1_050_000, { ...settings, bonusPercent: Number.NaN })).toBe(105);
    expect(pointsToEarn(1_050_000, { ...settings, enabled: false, bonusPercent: 100 })).toBe(0);
  });
});

describe("activeBonus", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  it("finds a running bonus", () => {
    expect(activeBonus([bonus()], now)?.name).toBe("Weekend");
  });
  it("ignores future, ended and switched-off bonuses (end is exclusive)", () => {
    expect(activeBonus([bonus({ startsAt: "2026-11-16T00:00:00Z", endsAt: "2026-11-17T00:00:00Z" })], now)).toBeNull();
    expect(activeBonus([bonus({ endsAt: "2026-11-15T10:00:00Z" })], now)).toBeNull();
    expect(activeBonus([bonus({ active: false })], now)).toBeNull();
  });
  it("takes the best, never the sum", () => {
    const best = activeBonus([bonus({ id: "a", bonusPercent: 50 }), bonus({ id: "b", bonusPercent: 200 })], now);
    expect(best?.bonusPercent).toBe(200);
  });
});

describe("tiers", () => {
  const tiers = [tier("Silver", 0, 0), tier("Gold", 5_000_000, 10), tier("Platinum", 20_000_000, 25)];
  it("picks the highest reached tier", () => {
    expect(tierFor(0, tiers)?.name).toBe("Silver");
    expect(tierFor(4_999_999, tiers)?.name).toBe("Silver");
    expect(tierFor(5_000_000, tiers)?.name).toBe("Gold");
    expect(tierFor(99_000_000, tiers)?.name).toBe("Platinum");
  });
  it("has no tier when none is reached or none exist", () => {
    expect(tierFor(100, [tier("Gold", 5_000_000, 10)])).toBeNull();
    expect(tierFor(100, [])).toBeNull();
  });
  it("says what the next tier needs", () => {
    expect(nextTier(1_000_000, tiers)).toMatchObject({ remaining: 4_000_000, tier: { name: "Gold" } });
    expect(nextTier(99_000_000, tiers)).toBeNull();
  });
  it("adds tier and bonus, capped", () => {
    expect(earnBonusPercent(tiers[1], bonus())).toBe(110);
    expect(earnBonusPercent(null, null)).toBe(0);
    expect(earnBonusPercent(tier("X", 0, 400), bonus({ bonusPercent: 400 }))).toBe(500);
  });
});

describe("expiryPicture", () => {
  const now = new Date("2026-11-30T00:00:00Z");
  const day = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  it("is off with 0 days", () => {
    expect(expiryPicture([{ points: 10, createdAt: day(500) }], 0, now)).toEqual({ expiredNow: 0, soon: 0, nextAt: null });
  });
  it("expires old unspent points and ignores young ones", () => {
    const result = expiryPicture([{ points: 10, createdAt: day(100) }, { points: 5, createdAt: day(10) }], 90, now);
    expect(result.expiredNow).toBe(10);
  });
  it("spends the oldest points first", () => {
    // 10 old + 5 young, 8 spent: the old lot has 2 left, so 2 expire; the young lot is untouched.
    const result = expiryPicture(
      [
        { points: 10, createdAt: day(100) },
        { points: 5, createdAt: day(10) },
        { points: -8, createdAt: day(5) },
      ],
      90,
      now,
    );
    expect(result.expiredNow).toBe(2);
  });
  it("expires nothing when spending covers the old points", () => {
    const result = expiryPicture(
      [
        { points: 10, createdAt: day(100) },
        { points: -10, createdAt: day(50) },
      ],
      90,
      now,
    );
    expect(result.expiredNow).toBe(0);
  });
  it("is stable after an expire row has been written", () => {
    const result = expiryPicture(
      [
        { points: 10, createdAt: day(100) },
        { points: -10, createdAt: day(0) }, // the 'expire' entry
      ],
      90,
      now,
    );
    expect(result.expiredNow).toBe(0);
  });
  it("warns about points expiring within the window", () => {
    const result = expiryPicture([{ points: 7, createdAt: day(80) }], 90, now, 30);
    expect(result.soon).toBe(7);
    expect(result.nextAt?.toISOString()).toBe(new Date(now.getTime() + 10 * 86_400_000).toISOString());
  });
});

describe("parseExpiryDays", () => {
  it("accepts 0 to 3650 whole days", () => {
    expect(parseExpiryDays("0")).toBe(0);
    expect(parseExpiryDays(" 365 ")).toBe(365);
    expect(parseExpiryDays("3650")).toBe(3650);
  });
  it("rejects the rest", () => {
    for (const bad of ["", "-1", "3651", "1.5", "abc"]) expect(parseExpiryDays(bad)).toBeNull();
  });
});

describe("parseBonusForm", () => {
  const good = { name: "Weekend", bonusPercent: "100", startsAt: "2026-11-14T00:00:00Z", endsAt: "2026-11-16T00:00:00Z" };
  it("accepts a valid bonus", () => {
    expect(parseBonusForm(good)).toMatchObject({ ok: true, value: { name: "Weekend", bonusPercent: 100 } });
  });
  it("rejects bad names, percents and dates", () => {
    expect(parseBonusForm({ ...good, name: " " }).ok).toBe(false);
    expect(parseBonusForm({ ...good, name: "x".repeat(61) }).ok).toBe(false);
    for (const bonusPercent of ["0", "501", "-5", "1.5", ""]) {
      expect(parseBonusForm({ ...good, bonusPercent }).ok).toBe(false);
    }
    expect(parseBonusForm({ ...good, endsAt: good.startsAt }).ok).toBe(false);
    expect(parseBonusForm({ ...good, startsAt: "nope" }).ok).toBe(false);
  });
});

describe("parseTierForm", () => {
  const existing = [tier("Silver", 0, 0)];
  it("accepts a tier and allows 0 bonus and 0 spend", () => {
    expect(parseTierForm({ name: "Gold", minSpend: "50000", bonusPercent: "10" }, existing)).toMatchObject({
      ok: true,
      value: { name: "Gold", minSpend: 5_000_000, bonusPercent: 10 },
    });
    expect(parseTierForm({ name: "Base", minSpend: "0", bonusPercent: "0" }, [])).toMatchObject({
      ok: true,
      value: { minSpend: 0, bonusPercent: 0 },
    });
  });
  it("rejects a duplicate threshold, bad numbers and a sixth tier", () => {
    expect(parseTierForm({ name: "Dup", minSpend: "0", bonusPercent: "5" }, existing).ok).toBe(false);
    expect(parseTierForm({ name: "X", minSpend: "abc", bonusPercent: "5" }, existing).ok).toBe(false);
    expect(parseTierForm({ name: "X", minSpend: "100", bonusPercent: "501" }, existing).ok).toBe(false);
    const five = Array.from({ length: 5 }, (_, i) => tier(`T${i}`, i * 100, 0));
    expect(parseTierForm({ name: "Six", minSpend: "9999", bonusPercent: "1" }, five).ok).toBe(false);
  });
});

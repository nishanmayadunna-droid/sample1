import { describe, expect, it } from "vitest";
import { estimateCost } from "./chat-tokens";

describe("estimateCost", () => {
  it("works out the cost per message, per day and per 30-day month", () => {
    const r = estimateCost({
      messagesPerDay: 1000,
      inputTokens: 1500,
      outputTokens: 300,
      inputPricePerMillion: 1,
      outputPricePerMillion: 5,
    });
    expect(r.perMessage).toBeCloseTo(0.003, 6);
    expect(r.perDay).toBeCloseTo(3, 6);
    expect(r.perMonth).toBeCloseTo(90, 6);
  });
  it("honours a custom number of days", () => {
    const r = estimateCost({ messagesPerDay: 10, inputTokens: 1000000, outputTokens: 0, inputPricePerMillion: 2, outputPricePerMillion: 0, days: 7 });
    expect(r.perDay).toBeCloseTo(20, 6);
    expect(r.perMonth).toBeCloseTo(140, 6);
  });
  it("returns zeros for negative, missing or non-finite input", () => {
    const zero = { perMessage: 0, perDay: 0, perMonth: 0 };
    expect(estimateCost({ messagesPerDay: -1, inputTokens: 100, outputTokens: 100, inputPricePerMillion: 1, outputPricePerMillion: 1 })).toEqual(zero);
    expect(estimateCost({ messagesPerDay: 10, inputTokens: NaN, outputTokens: 100, inputPricePerMillion: 1, outputPricePerMillion: 1 })).toEqual(zero);
    expect(estimateCost({ messagesPerDay: 10, inputTokens: 100, outputTokens: 100, inputPricePerMillion: Infinity, outputPricePerMillion: 1 })).toEqual(zero);
  });
});

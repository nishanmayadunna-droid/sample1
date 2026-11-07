// Cost estimate for the Maya AI engine. The owner types the prices; none are stored in code.

export type CostInput = {
  messagesPerDay: number;
  inputTokens: number;
  outputTokens: number;
  /** In the owner's currency, per million tokens. */
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  days?: number;
};

export type CostEstimate = { perMessage: number; perDay: number; perMonth: number };

/** Cost per message, per day and over `days` (default 30). Bad input gives zeros, never NaN. */
export function estimateCost(input: CostInput): CostEstimate {
  const values = [
    input.messagesPerDay,
    input.inputTokens,
    input.outputTokens,
    input.inputPricePerMillion,
    input.outputPricePerMillion,
  ];
  const days = input.days ?? 30;
  if (!values.every((v) => Number.isFinite(v) && v >= 0) || !Number.isFinite(days) || days < 0) {
    return { perMessage: 0, perDay: 0, perMonth: 0 };
  }
  const perMessage =
    (input.inputTokens * input.inputPricePerMillion + input.outputTokens * input.outputPricePerMillion) / 1_000_000;
  const perDay = perMessage * input.messagesPerDay;
  return { perMessage, perDay, perMonth: perDay * days };
}

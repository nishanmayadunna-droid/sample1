import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createCartSaver } from "./cart-saver";

const a = [{ id: "a", size: "M", quantity: 1 }];
const b = [{ id: "b", size: "L", quantity: 2 }];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("saves once 1000ms after the last schedule", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const saver = createCartSaver(save);
  saver.schedule(a);
  await vi.advanceTimersByTimeAsync(500);
  saver.schedule(b);
  await vi.advanceTimersByTimeAsync(999);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(b);
  expect(saver.hasPending()).toBe(false);
});

it("flush saves immediately and clears pending", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const saver = createCartSaver(save);
  saver.schedule(a);
  expect(saver.hasPending()).toBe(true);
  await saver.flush();
  expect(save).toHaveBeenCalledWith(a);
  expect(saver.hasPending()).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).toHaveBeenCalledTimes(1);
});

it("flush with nothing pending does not call save", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await createCartSaver(save).flush();
  expect(save).not.toHaveBeenCalled();
});

it("stays pending after a failed save and retries on flush", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(undefined);
  const saver = createCartSaver(save);
  saver.schedule(a);
  await vi.advanceTimersByTimeAsync(1000);
  expect(saver.hasPending()).toBe(true);
  await saver.flush();
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(a);
  expect(saver.hasPending()).toBe(false);
});

it("keeps newer lines pending when they arrive during a save", async () => {
  let resolveFirst!: () => void;
  const save = vi
    .fn()
    .mockImplementationOnce(() => new Promise<void>((r) => (resolveFirst = r)))
    .mockResolvedValue(undefined);
  const saver = createCartSaver(save);
  saver.schedule(a);
  const flushing = saver.flush();
  saver.schedule(b);
  resolveFirst();
  await flushing;
  expect(saver.hasPending()).toBe(true);
  await saver.flush();
  expect(save).toHaveBeenLastCalledWith(b);
  expect(saver.hasPending()).toBe(false);
});

it("cancel drops pending lines", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const saver = createCartSaver(save);
  saver.schedule(a);
  saver.cancel();
  expect(saver.hasPending()).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).not.toHaveBeenCalled();
});

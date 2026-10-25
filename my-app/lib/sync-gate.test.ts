import { expect, it, vi } from "vitest";
import { createSyncGate } from "./sync-gate";

it("runs tasks while open", async () => {
  const gate = createSyncGate();
  const task = vi.fn().mockResolvedValue(undefined);
  await gate.run(task);
  expect(task).toHaveBeenCalledTimes(1);
});

it("close waits for in-flight tasks to settle", async () => {
  const gate = createSyncGate();
  let finish!: () => void;
  const order: string[] = [];
  void gate.run(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          order.push("task done");
          resolve();
        };
      }),
  );
  const closed = gate.close().then(() => order.push("closed"));
  await Promise.resolve();
  expect(order).toEqual([]);
  finish();
  await closed;
  expect(order).toEqual(["task done", "closed"]);
});

it("close also waits for a task that rejects", async () => {
  const gate = createSyncGate();
  void gate.run(() => Promise.reject(new Error("boom"))).catch(() => {});
  await expect(gate.close()).resolves.toBeUndefined();
});

it("does not start tasks after close", async () => {
  const gate = createSyncGate();
  await gate.close();
  const task = vi.fn().mockResolvedValue(undefined);
  await gate.run(task);
  expect(task).not.toHaveBeenCalled();
  expect(gate.isClosed()).toBe(true);
});

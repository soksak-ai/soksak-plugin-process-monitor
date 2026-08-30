import { describe, expect, it, vi } from "vitest";
import type { Inventory } from "./host.js";
import { InventoryEventWaiter } from "./wait.js";

const inventory = (revision: number, count: number): Inventory => ({
  owners: [{
    owner: "soksak-sidecar-pty",
    revision,
    processes: Array.from({ length: count }, (_, index) => ({
      id: `process-${index}`,
      owner: "soksak-sidecar-pty",
      pid: index + 1,
      parentPid: 0,
      command: `process-${index}`,
      state: "running" as const,
      startedAtUnixMs: 1,
    })),
  }],
});

describe("process inventory event waiter", () => {
  it("resolves only after an event-reduced snapshot satisfies both conditions", async () => {
    const waiter = new InventoryEventWaiter();
    const pending = waiter.wait(inventory(4, 4), {
      owner: "soksak-sidecar-pty",
      afterRevision: 4,
      processCount: 5,
      timeoutMs: 10_000,
    });
    let settled = false;
    void pending.finally(() => { settled = true; });

    waiter.update(inventory(5, 4));
    await Promise.resolve();
    expect(settled).toBe(false);

    waiter.update(inventory(6, 5));
    await expect(pending).resolves.toEqual({
      owner: "soksak-sidecar-pty",
      revision: 6,
      processCount: 5,
    });
  });

  it("uses a deadline only to bound an absent event", async () => {
    vi.useFakeTimers();
    const waiter = new InventoryEventWaiter();
    const pending = waiter.wait(inventory(4, 4), {
      owner: "soksak-sidecar-pty",
      afterRevision: 4,
      timeoutMs: 25,
    });
    const assertion = expect(pending).rejects.toThrow("PROCESS_WAIT_TIMEOUT");
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    vi.useRealTimers();
  });
});

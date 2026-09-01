import { describe, expect, it, vi } from "vitest";
import processMonitor from "./index.js";

describe("process monitor command surface", () => {
  it("declares every wait parameter in the public command schema", () => {
    const commands = new Map<string, Record<string, unknown>>();
    processMonitor.activate({
      app: {
        commands: {
          register(name, spec) {
            commands.set(name, spec as unknown as Record<string, unknown>);
            return { dispose() {} };
          },
          async execute() { return { ok: true, data: { owners: [] } }; },
        },
      },
      subscriptions: [],
    });

    expect(commands.get("wait")?.params).toEqual({
      owner: expect.objectContaining({ type: "string", required: true }),
      afterRevision: expect.objectContaining({ type: "number", required: true }),
      processCount: expect.objectContaining({ type: "number" }),
      timeoutMs: expect.objectContaining({ type: "number" }),
    });
  });

  it("returns a machine-readable timeout instead of throwing INTERNAL", async () => {
    vi.useFakeTimers();
    const commands = new Map<string, Record<string, unknown>>();
    processMonitor.activate({
      app: {
        commands: {
          register(name, spec) {
            commands.set(name, spec as unknown as Record<string, unknown>);
            return { dispose() {} };
          },
          async execute() {
            return {
              ok: true,
              data: { owners: [{ owner: "soksak-sidecar-pty", revision: 4, processes: [] }] },
            };
          },
        },
      },
      subscriptions: [],
    });
    const handler = commands.get("wait")?.handler as
      | ((params: Record<string, unknown>) => Promise<object>)
      | undefined;
    const pending = handler?.({
      owner: "soksak-sidecar-pty",
      afterRevision: 4,
      timeoutMs: 25,
    });
    const assertion = expect(pending).resolves.toMatchObject({
      ok: false,
      code: "TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    vi.useRealTimers();
  });

  it("retains an event received while the initial inventory snapshot is in flight", async () => {
    const commands = new Map<string, Record<string, unknown>>();
    let onInventoryChanged: ((event: { revision: number; kind: "started"; process: {
      id: string; owner: string; pid: number; parentPid: number; command: string;
      state: "running"; startedAtUnixMs: number; cwd: string;
    } }) => void) | undefined;
    let resolveInventory: ((value: Record<string, unknown>) => void) | undefined;
    processMonitor.activate({
      app: {
        commands: {
          register(name, spec) {
            commands.set(name, spec as unknown as Record<string, unknown>);
            return { dispose() {} };
          },
          execute() {
            return new Promise((resolve) => { resolveInventory = resolve; });
          },
        },
        events: {
          on(_name, listener) {
            onInventoryChanged = listener as typeof onInventoryChanged;
            return { dispose() {} };
          },
        },
      },
      subscriptions: [],
    });

    const refresh = commands.get("refresh")?.handler as () => Promise<object>;
    const pending = refresh();
    onInventoryChanged?.({
      revision: 2,
      kind: "started",
      process: {
        id: "shell-1", owner: "soksak-sidecar-pty", pid: 42, parentPid: 7,
        command: "/bin/zsh -l", state: "running", startedAtUnixMs: 1, cwd: "/work",
      },
    });
    resolveInventory?.({
      ok: true,
      data: { owners: [{ owner: "soksak-sidecar-pty", revision: 1, processes: [] }] },
    });
    await pending;

    const status = await (commands.get("status")?.handler as () => Promise<object>)();
    expect(status).toMatchObject({
      initialized: true,
      inventory: {
        owners: [{ revision: 2, processes: [{ id: "shell-1", cwd: "/work" }] }],
      },
    });
  });
});

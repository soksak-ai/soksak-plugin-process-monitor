import { describe, expect, it } from "vitest";
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
});

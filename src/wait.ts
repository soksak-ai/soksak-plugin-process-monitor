import type { Inventory } from "./host.js";

export interface InventoryWaitRequest {
  owner: string;
  afterRevision: number;
  processCount?: number;
  timeoutMs: number;
}

export interface InventoryWaitResult {
  owner: string;
  revision: number;
  processCount: number;
}

interface PendingWait {
  request: InventoryWaitRequest;
  resolve(result: InventoryWaitResult): void;
  reject(error: Error): void;
  deadline: ReturnType<typeof setTimeout>;
}

const safeInteger = (value: unknown, name: string, minimum: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`PROCESS_WAIT_INVALID_${name.toUpperCase()}`);
  }
  return value as number;
};

export function parseInventoryWaitRequest(params: Record<string, unknown>): InventoryWaitRequest {
  const owner = typeof params.owner === "string" ? params.owner.trim() : "";
  if (!owner) throw new Error("PROCESS_WAIT_INVALID_OWNER");
  const afterRevision = safeInteger(params.afterRevision, "after_revision", 0);
  const processCount = params.processCount === undefined
    ? undefined
    : safeInteger(params.processCount, "process_count", 0);
  const timeoutMs = params.timeoutMs === undefined
    ? 10_000
    : safeInteger(params.timeoutMs, "timeout_ms", 1);
  if (timeoutMs > 60_000) throw new Error("PROCESS_WAIT_INVALID_TIMEOUT_MS");
  return { owner, afterRevision, processCount, timeoutMs };
}

export function matchInventoryWait(
  inventory: Inventory,
  request: InventoryWaitRequest,
): InventoryWaitResult | null {
  const owner = inventory.owners.find((candidate) => candidate.owner === request.owner);
  if (!owner || owner.revision <= request.afterRevision) return null;
  const processCount = Array.isArray(owner.processes) ? owner.processes.length : 0;
  if (request.processCount !== undefined && processCount !== request.processCount) return null;
  return { owner: owner.owner, revision: owner.revision, processCount };
}

export class InventoryEventWaiter {
  private readonly pending = new Set<PendingWait>();

  wait(inventory: Inventory, params: Record<string, unknown>): Promise<InventoryWaitResult> {
    const request = parseInventoryWaitRequest(params);
    const current = matchInventoryWait(inventory, request);
    if (current) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const pending: PendingWait = {
        request,
        resolve,
        reject,
        deadline: setTimeout(() => {
          this.pending.delete(pending);
          reject(new Error(
            `PROCESS_WAIT_TIMEOUT: ${request.owner} revision>${request.afterRevision}`,
          ));
        }, request.timeoutMs),
      };
      this.pending.add(pending);
    });
  }

  update(inventory: Inventory): void {
    for (const pending of [...this.pending]) {
      const result = matchInventoryWait(inventory, pending.request);
      if (!result) continue;
      clearTimeout(pending.deadline);
      this.pending.delete(pending);
      pending.resolve(result);
    }
  }

  fail(error: unknown): void {
    const failure = error instanceof Error ? error : new Error(String(error));
    for (const pending of [...this.pending]) {
      clearTimeout(pending.deadline);
      this.pending.delete(pending);
      pending.reject(failure);
    }
  }

  dispose(): void {
    this.fail(new Error("PROCESS_WAIT_DISPOSED"));
  }
}

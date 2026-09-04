export interface Disposable { dispose(): void }
export interface ProcessRecord {
  id: string; owner: string; window?: string; pane?: string; pid: number; parentPid: number;
  command: string; state: "running" | "ended"; startedAtUnixMs: number; endedAtUnixMs?: number; cwd?: string;
}
export interface ProjectProcessRecord extends ProcessRecord { project: string; projectRoot: string }
export interface OwnerInventory { owner: string; revision: number; processes: ProcessRecord[] }
export interface Inventory { owners: OwnerInventory[] }
export interface ProcessEvent { revision: number; kind: "started" | "updated" | "ended"; process: ProcessRecord }
export interface ViewContext { projectId: string; root: string | null; paneId: string | null; setBadge(badge: number | "dot" | null): void }
export interface CommandParamSpec {
  type: "string" | "number" | "boolean" | "string[]" | "number[]" | "json";
  description: string | { en: string; ko: string };
  required?: boolean;
}
export interface CommandRegistrationSpec {
  handler: (params: Record<string, unknown>) => Promise<object> | object;
  description: string | { en: string; ko: string };
  params?: Record<string, CommandParamSpec>;
  returns?: string;
}
export interface Api {
  commands?: { register(name: string, spec: CommandRegistrationSpec): Disposable; execute(name: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> };
  ui?: {
    registerView(id: string, provider: {
      /** What the view needs to come back (core SESSION S1-5): this one reads the inventory again. */
      restores: "none" | "view" | "session";
      mount(container: HTMLElement, ctx: ViewContext): void;
      unmount?(container: HTMLElement): void;
    }): Disposable;
  };
  events?: { on(event: "process.inventory.changed", listener: (event: ProcessEvent) => void): Disposable };
}
export interface Context { app: Api; subscriptions: Disposable[] }

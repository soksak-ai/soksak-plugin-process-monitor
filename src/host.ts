export interface Disposable { dispose(): void }
export interface ProcessRecord {
  id: string; owner: string; window?: string; pane?: string; pid: number; parentPid: number;
  command: string; state: "running" | "ended"; startedAtUnixMs: number; endedAtUnixMs?: number; cwd?: string;
}
export interface OwnerInventory { owner: string; revision: number; processes: ProcessRecord[] }
export interface Inventory { owners: OwnerInventory[] }
export interface ViewContext { projectId: string; root: string | null; paneId: string | null; setBadge(badge: number | "dot" | null): void }
export interface Api {
  commands?: { register(name: string, spec: { handler: (params: Record<string, unknown>) => Promise<object> | object; description: string }): Disposable; execute(name: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> };
  ui?: { registerView(id: string, provider: { mount(container: HTMLElement, ctx: ViewContext): void; unmount?(container: HTMLElement): void }): Disposable };
}
export interface Context { app: Api; subscriptions: Disposable[] }

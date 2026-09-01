import type {
  Context,
  Inventory,
  ProcessEvent,
  ProcessRecord,
  ProjectProcessRecord,
  ViewContext,
} from "./host.js";
import { InventoryEventWaiter } from "./wait.js";

export function applyProcessEvent(inventory: Inventory, event: ProcessEvent): Inventory {
  const ownerName = event.process.owner;
  if (!ownerName || !Number.isSafeInteger(event.revision) || event.revision < 1) {
    throw new Error("PROCESS_EVENT_INVALID");
  }
  const ownerIndex = inventory.owners.findIndex((owner) => owner.owner === ownerName);
  const current = ownerIndex < 0
    ? { owner: ownerName, revision: 0, processes: [] as ProcessRecord[] }
    : inventory.owners[ownerIndex];
  if (event.revision <= current.revision) return inventory;
  if (event.revision !== current.revision + 1) {
    throw new Error(`PROCESS_REVISION_GAP: ${ownerName} ${current.revision}->${event.revision}`);
  }
  let processes = current.processes.filter((process) => process.id !== event.process.id);
  if (event.kind === "started" || event.kind === "updated") processes = [...processes, event.process];
  else if (event.kind !== "ended") throw new Error(`PROCESS_EVENT_KIND_INVALID: ${event.kind}`);
  const nextOwner = { ...current, revision: event.revision, processes };
  const owners = [...inventory.owners];
  if (ownerIndex < 0) owners.push(nextOwner);
  else owners[ownerIndex] = nextOwner;
  owners.sort((left, right) => left.owner.localeCompare(right.owner));
  return { owners };
}

const node = (document: Document, tag: string, text = "") => { const element = document.createElement(tag); element.textContent = text; return element; };
export function selectProjectProcesses(inventory: Inventory, rootPath: string | null): ProcessRecord[] {
  if (!rootPath) return [];
  const root = normalizeProjectRoot(rootPath);
  const inProject = (cwd: string) => cwd === root || cwd.startsWith(`${root}/`);
  return inventory.owners.flatMap((owner) => (Array.isArray(owner.processes) ? owner.processes : [])
    .filter((process) => typeof process.cwd === "string" && process.cwd !== "" && inProject(process.cwd)));
}
export function selectProjectProcessRecords(
  inventory: Inventory,
  project: string,
  rootPath: string | null,
): ProjectProcessRecord[] {
  if (!rootPath) return [];
  const projectRoot = normalizeProjectRoot(rootPath);
  return selectProjectProcesses(inventory, rootPath).map((process) => ({
    ...process,
    project,
    projectRoot,
  }));
}
const normalizeProjectRoot = (rootPath: string): string => rootPath.replace(/[\\/]+$/, "") || "/";
export function processMonitorStatus(
  initialized: boolean,
  failure: string,
  inventory: Inventory,
  views: Iterable<Pick<ViewContext, "projectId" | "root">>,
) {
  const unique = new Map<string, Pick<ViewContext, "projectId" | "root">>();
  for (const view of views) {
    const root = view.root === null ? null : normalizeProjectRoot(view.root);
    unique.set(`${view.projectId}\u0000${root ?? ""}`, root === view.root ? view : { ...view, root });
  }
  return {
    initialized,
    failure,
    inventory,
    projects: [...unique.values()].map((view) => ({
      project: view.projectId,
      root: view.root === null ? null : normalizeProjectRoot(view.root),
      processes: selectProjectProcessRecords(inventory, view.projectId, view.root),
    })),
  };
}
export function countProcessesWithoutCwd(inventory: Inventory): number {
  return inventory.owners.reduce((count, owner) => count + (Array.isArray(owner.processes)
    ? owner.processes.filter((process) => typeof process.cwd !== "string" || process.cwd === "").length
    : 0), 0);
}
function render(
  container: HTMLElement,
  inventory: Inventory,
  project: string,
  rootPath: string | null,
  error = "",
): void {
  container.replaceChildren();
  const root = node(container.ownerDocument, "section"); root.dataset.node = "root";
  Object.assign(root.style, { color: "var(--fg)", background: "var(--card)", padding: "12px", minHeight: "100%", minWidth: "0", boxSizing: "border-box", fontFamily: "inherit", overflow: "hidden" });
  const list = node(container.ownerDocument, "div"); list.dataset.node = "list";
  Object.assign(list.style, { display: "grid", gap: "8px", color: "inherit", minWidth: "0" });
  if (error) { const failure = node(container.ownerDocument, "p", `PROCESS_INVENTORY_FAILED: ${error}`); failure.dataset.node = "process-monitor/error"; list.append(failure); }
  const missingCwd = countProcessesWithoutCwd(inventory);
  if (missingCwd > 0) { const warning = node(container.ownerDocument, "p", `PROCESS_CWD_UNAVAILABLE: ${missingCwd}`); warning.dataset.node = "process-cwd-unavailable"; list.append(warning); }
  const selected = selectProjectProcessRecords(inventory, project, rootPath);
  const owners = inventory.owners.map((owner) => ({
    ...owner,
    processes: selected.filter((process) => process.owner === owner.owner),
  })).filter((owner) => owner.processes.length > 0);
  if (!rootPath) { const missing = node(container.ownerDocument, "p", "PROJECT_ROOT_UNAVAILABLE"); missing.dataset.node = "project-root-error"; list.append(missing); }
  else if (owners.length === 0) { const empty = node(container.ownerDocument, "p", "No owned processes in this project"); empty.dataset.node = "empty"; list.append(empty); }
  for (const owner of owners) {
    const heading = node(container.ownerDocument, "h3", owner.owner); list.append(heading);
    for (const process of owner.processes) {
      const row = node(
        container.ownerDocument,
        "div",
        `${process.command} · pid ${process.pid} · ppid ${process.parentPid} · pane ${process.pane ?? "-"} · project ${process.project} · cwd ${process.cwd} · lifecycle ${process.state}`,
      );
      row.dataset.processId = process.id;
      Object.assign(row.style, { minWidth: "0", overflowWrap: "anywhere", wordBreak: "break-word" });
      list.append(row);
    }
  }
  root.append(list); container.append(root);
}
export default {
  activate(ctx: Context) {
    const app = ctx.app;
    let current: Inventory = { owners: [] };
    let failure = "";
    let initialized = false;
    const pendingEvents: ProcessEvent[] = [];
    const waiter = new InventoryEventWaiter();
    const mounted = new Map<HTMLElement, Pick<ViewContext, "projectId" | "root">>();
    const repaint = () => mounted.forEach((view, container) => {
      render(container, current, view.projectId, view.root, failure);
    });
    const refresh = async () => {
      try {
        const result = await app.commands?.execute("process.inventory");
        if (!result || result.ok !== true) { failure = `${result?.code ?? "NO_RESULT"}: ${result?.message ?? "command returned no data"}`; return current; }
        const payload = result.data as { owners?: unknown } | undefined;
        if (payload && Array.isArray(payload.owners)) {
          current = payload as Inventory;
          failure = "";
          initialized = true;
          // The snapshot and the event stream are one ordered boundary. Events received while the
          // first snapshot was in flight must not disappear between those two operations; stale
          // replays are ignored by the same revision reducer used after initialization.
          for (const event of pendingEvents.splice(0)) {
            try {
              current = applyProcessEvent(current, event);
            } catch (error) {
              failure = String(error);
              waiter.fail(error);
              break;
            }
          }
          waiter.update(current);
        }
        else failure = "INVALID_DATA: owners array is missing";
      } catch (error) { failure = String(error); }
      repaint();
      return current;
    };
    ctx.subscriptions.push(app.commands?.register("refresh", { description: "Refresh process inventory", handler: async () => { await refresh(); return { owners: current.owners.length }; } }) ?? { dispose() {} });
    ctx.subscriptions.push(app.commands?.register("status", {
      description: "Read the current event-reduced process inventory",
      handler: () => processMonitorStatus(initialized, failure, current, mounted.values()),
    }) ?? { dispose() {} });
    ctx.subscriptions.push(app.commands?.register("wait", {
      description: {
        en: "Wait for an event-reduced process inventory condition",
        ko: "이벤트로 축약된 프로세스 inventory 조건을 기다립니다.",
      },
      params: {
        owner: {
          type: "string",
          description: { en: "Process inventory owner", ko: "프로세스 inventory owner" },
          required: true,
        },
        afterRevision: {
          type: "number",
          description: { en: "Require a revision greater than this value", ko: "이 값보다 큰 revision을 기다립니다." },
          required: true,
        },
        processCount: {
          type: "number",
          description: { en: "Optional exact process count", ko: "선택적인 정확한 프로세스 수" },
        },
        timeoutMs: {
          type: "number",
          description: { en: "Failure deadline in milliseconds", ko: "실패 기한(밀리초)" },
        },
      },
      returns: "{ owner, revision, processCount }",
      handler: async (params) => {
        if (!initialized) await refresh();
        if (failure) throw new Error(failure);
        try {
          return await waiter.wait(current, params);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.startsWith("PROCESS_WAIT_TIMEOUT:")) {
            return { ok: false, code: "TIMEOUT", message };
          }
          throw error;
        }
      },
    }) ?? { dispose() {} });
    if (app.events) ctx.subscriptions.push(app.events.on("process.inventory.changed", (event) => {
      if (!initialized) {
        pendingEvents.push(event);
        return;
      }
      try {
        current = applyProcessEvent(current, event);
        failure = "";
        waiter.update(current);
      } catch (error) {
        failure = String(error);
        waiter.fail(error);
      }
      repaint();
    }));
    ctx.subscriptions.push({ dispose: () => waiter.dispose() });
    ctx.subscriptions.push(app.ui?.registerView("process-monitor", { mount(container: HTMLElement, view: ViewContext) { mounted.set(container, { projectId: view.projectId, root: view.root }); render(container, current, view.projectId, view.root, "loading process inventory"); void refresh(); }, unmount(container: HTMLElement) { mounted.delete(container); container.replaceChildren(); } }) ?? { dispose() {} });
  },
};

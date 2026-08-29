import type { Context, Inventory, ViewContext } from "./host.js";

const node = (document: Document, tag: string, text = "") => { const element = document.createElement(tag); element.textContent = text; return element; };
function render(container: HTMLElement, inventory: Inventory, rootPath: string | null, error = ""): void {
  container.replaceChildren();
  const root = node(container.ownerDocument, "section"); root.dataset.node = "root";
  Object.assign(root.style, { color: "var(--fg)", background: "var(--card)", padding: "12px", minHeight: "100%", boxSizing: "border-box", fontFamily: "inherit" });
  const list = node(container.ownerDocument, "div"); list.dataset.node = "list";
  Object.assign(list.style, { display: "grid", gap: "8px", color: "inherit" });
  if (error) { const failure = node(container.ownerDocument, "p", `PROCESS_INVENTORY_FAILED: ${error}`); failure.dataset.node = "process-monitor/error"; list.append(failure); }
  const inProject = (cwd: string) => rootPath !== null && (cwd === rootPath || cwd.startsWith(`${rootPath}/`));
  const owners = inventory.owners.map((owner) => ({ ...owner, processes: owner.processes.filter((process) => inProject(process.cwd)) })).filter((owner) => owner.processes.length > 0);
  if (!rootPath) { const missing = node(container.ownerDocument, "p", "PROJECT_ROOT_UNAVAILABLE"); missing.dataset.node = "project-root-error"; list.append(missing); }
  else if (owners.length === 0) { const empty = node(container.ownerDocument, "p", "No owned processes in this project"); empty.dataset.node = "empty"; list.append(empty); }
  for (const owner of owners) {
    const heading = node(container.ownerDocument, "h3", owner.owner); list.append(heading);
    for (const process of owner.processes) {
      const row = node(container.ownerDocument, "div", `${process.command} · pid ${process.pid} · ${process.cwd} · ${process.state}`);
      row.dataset.processId = process.id; list.append(row);
    }
  }
  root.append(list); container.append(root);
}
export default {
  activate(ctx: Context) {
    const app = ctx.app;
    let current: Inventory = { owners: [] };
    let failure = "";
    const refresh = async () => {
      try {
        const result = await app.commands?.execute("process.inventory");
        if (!result || result.ok !== true) { failure = `${result?.code ?? "NO_RESULT"}: ${result?.message ?? "command returned no data"}`; return current; }
        const payload = result.data as { owners?: unknown } | undefined;
        if (payload && Array.isArray(payload.owners)) { current = payload as Inventory; failure = ""; }
        else failure = "INVALID_DATA: owners array is missing";
      } catch (error) { failure = String(error); }
      return current;
    };
    ctx.subscriptions.push(app.commands?.register("refresh", { description: "Refresh process inventory", handler: async () => { await refresh(); return { owners: current.owners.length }; } }) ?? { dispose() {} });
    ctx.subscriptions.push(app.ui?.registerView("process-monitor", { mount(container: HTMLElement, view: ViewContext) { render(container, current, view.root, "loading process inventory"); void refresh().then((inventory) => render(container, inventory, view.root, failure)); }, unmount(container: HTMLElement) { container.replaceChildren(); } }) ?? { dispose() {} });
  },
};

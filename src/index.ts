import type { Context, Inventory, ViewContext } from "./host.js";

const node = (document: Document, tag: string, text = "") => { const element = document.createElement(tag); element.textContent = text; return element; };
function render(container: HTMLElement, inventory: Inventory): void {
  container.replaceChildren();
  const root = node(container.ownerDocument, "section"); root.dataset.node = "process-monitor/root";
  const list = node(container.ownerDocument, "div"); list.dataset.node = "process-monitor/list";
  for (const owner of inventory.owners) {
    const heading = node(container.ownerDocument, "h3", owner.owner); list.append(heading);
    for (const process of owner.processes) {
      const row = node(container.ownerDocument, "div", `${process.command} · pid ${process.pid} · ${process.state}`);
      row.dataset.processId = process.id; list.append(row);
    }
  }
  root.append(list); container.append(root);
}
export default {
  activate(ctx: Context) {
    const app = ctx.app;
    let current: Inventory = { owners: [] };
    const refresh = async () => {
      const result = await app.commands?.execute("process.inventory");
      if (result) { current = result as unknown as Inventory; }
      return current;
    };
    ctx.subscriptions.push(app.commands?.register("refresh", { description: "Refresh process inventory", handler: async () => { await refresh(); return { owners: current.owners.length }; } }) ?? { dispose() {} });
    ctx.subscriptions.push(app.ui?.registerView("process-monitor", { mount(container: HTMLElement, _view: ViewContext) { void refresh().then((inventory) => render(container, inventory)); }, unmount(container: HTMLElement) { container.replaceChildren(); } }) ?? { dispose() {} });
  },
};

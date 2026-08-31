import { describe, expect, it } from "vitest";
import {
  applyProcessEvent,
  countProcessesWithoutCwd,
  processMonitorStatus,
  selectProjectProcessRecords,
  selectProjectProcesses,
} from "./index.js";

const process = (id: string, cwd: string) => ({ id, owner: "owner", pid: 1, parentPid: 0, command: id, state: "running" as const, startedAtUnixMs: 1, cwd });

describe("project process selection", () => {
  it("keeps only registered-owner records at or below the project root", () => {
    const inventory = { owners: [{ owner: "owner", revision: 1, processes: [process("root", "/work"), process("child", "/work/pkg"), process("sibling", "/workspace-other")] }] };
    expect(selectProjectProcesses(inventory, "/work").map((value) => value.id)).toEqual(["root", "child"]);
  });
  it("adds the selected project identity to every public project process record", () => {
    const inventory = { owners: [{ owner: "owner", revision: 1, processes: [process("root", "/work"), process("other", "/other")] }] };
    expect(selectProjectProcessRecords(inventory, "project-a", "/work")).toEqual([{
      ...process("root", "/work"),
      project: "project-a",
      projectRoot: "/work",
    }]);
  });
  it("publishes PID, PPID, cwd, pane, project, and lifecycle through status", () => {
    const record = { ...process("root", "/work"), pane: "tab-a.1", pid: 41, parentPid: 7 };
    const status = processMonitorStatus(
      true,
      "",
      { owners: [{ owner: "owner", revision: 1, processes: [record] }] },
      [{ projectId: "project-a", root: "/work" }],
    );
    expect(status.projects[0]?.processes[0]).toMatchObject({
      pid: 41,
      parentPid: 7,
      cwd: "/work",
      pane: "tab-a.1",
      project: "project-a",
      state: "running",
    });
  });
  it("returns no process when the project root is unavailable", () => {
    expect(selectProjectProcesses({ owners: [{ owner: "owner", revision: 1, processes: [process("one", "/work")] }] }, null)).toEqual([]);
  });
  it("treats a null process list as an empty owner snapshot", () => {
    expect(selectProjectProcesses({ owners: [{ owner: "owner", revision: 1, processes: null as never }] }, "/work")).toEqual([]);
  });
  it("does not crash when an owner legitimately omits an unavailable cwd", () => {
    const withoutCwd = { id: "shell", owner: "owner", pid: 1, parentPid: 0, command: "zsh", state: "running" as const, startedAtUnixMs: 1 };
    const inventory = { owners: [{ owner: "owner", revision: 1, processes: [withoutCwd] }] };
    expect(selectProjectProcesses(inventory, "/work")).toEqual([]);
    expect(countProcessesWithoutCwd(inventory)).toBe(1);
  });
});

describe("process event reduction", () => {
  const eventProcess = process("shell", "/work");
  it("applies one next revision and ignores a stale replay", () => {
    const initial = { owners: [{ owner: "owner", revision: 1, processes: [] }] };
    const started = applyProcessEvent(initial, { revision: 2, kind: "started", process: eventProcess });
    expect(started.owners[0]).toMatchObject({ revision: 2, processes: [eventProcess] });
    expect(applyProcessEvent(started, { revision: 2, kind: "started", process: eventProcess })).toBe(started);
  });
  it("removes an ended process and refuses a revision gap", () => {
    const initial = { owners: [{ owner: "owner", revision: 2, processes: [eventProcess] }] };
    expect(applyProcessEvent(initial, { revision: 3, kind: "ended", process: { ...eventProcess, state: "ended" } }).owners[0])
      .toMatchObject({ revision: 3, processes: [] });
    expect(() => applyProcessEvent(initial, { revision: 4, kind: "updated", process: eventProcess }))
      .toThrow(/PROCESS_REVISION_GAP/);
  });
});

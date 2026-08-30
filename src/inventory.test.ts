import { describe, expect, it } from "vitest";
import { countProcessesWithoutCwd, selectProjectProcesses } from "./index.js";

const process = (id: string, cwd: string) => ({ id, owner: "owner", pid: 1, parentPid: 0, command: id, state: "running" as const, startedAtUnixMs: 1, cwd });

describe("project process selection", () => {
  it("keeps only registered-owner records at or below the project root", () => {
    const inventory = { owners: [{ owner: "owner", revision: 1, processes: [process("root", "/work"), process("child", "/work/pkg"), process("sibling", "/workspace-other")] }] };
    expect(selectProjectProcesses(inventory, "/work").map((value) => value.id)).toEqual(["root", "child"]);
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

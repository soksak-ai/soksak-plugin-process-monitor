# soksak-plugin-process-monitor

This plugin is a read-only sidebar consumer of the public `process.inventory` command. It never
scans the workstation, reads a terminal plugin's DOM, or infers ownership from an executable name.
The view is project-scoped: it renders only records whose owner is registered in the selected
environment and whose published `cwd` equals or is below the current project root. A terminal or
sidecar has to be open for a record to exist; a browser view creates no process record. The view
renders the revisioned owner snapshot obtained at mount. It then applies the public
`process.inventory.changed` stream once per monotonic revision; stale events are ignored and a gap
is exposed as `PROCESS_REVISION_GAP` instead of repaired by polling. The explicit `refresh` command
is operator recovery, and the read-only `status` command exposes the current reduced snapshot,
initialization state and failure. For each mounted project, `status.projects` adds the project id and
root to its selected process records. The UI and status expose PID, PPID, cwd, pane, project, and
lifecycle from that same projection. The `wait` command observes that same event-reduced state and
completes when one owner advances beyond a caller-supplied revision and, when requested, reaches an
exact process count. It does not poll; its timer is only a bounded failure deadline when no matching
event arrives, and that deadline returns the machine-readable `TIMEOUT` code rather than an internal
exception. A record with no optional `cwd` is counted as
`PROCESS_CWD_UNAVAILABLE` and is not attributed to a project.

The plugin has no runtime dependency on another plugin. Core's sidebar section API places it beside
the work, and the process contract supplies its data.

`parentPid` is an observed operating-system relationship, not an ownership decision. A daemon may
continue after Core exits and then legitimately have parent PID 1. Ownership is determined from the
registered owner, project root, identity home and lifecycle state exposed by the process contract.
The monitor must not label a record unowned from `parentPid` alone.

## Verification

Use the public commands below against a running host. `sections.left` places the section in the fixed
sidebar; `plugin.soksak-plugin-process-monitor.status` returns the machine-readable inventory.

```sh
sok sections.left '{"set":"<process-monitor-section-set>"}'
sok workspace.region.toggle '{"region":"left","open":true}'
sok plugin.soksak-plugin-process-monitor.status '{}'
```

The result is GREEN only when each selected process has `pid`, `parentPid`, `cwd`, `pane`, `project`,
and `state`, and the event revision increases without a gap. A screenshot is required for the visual
check; the status response and the screenshot are separate evidence.

## Build

```sh
make verify
make publish-local STORE=/absolute/local-release-store OUT=/absolute/release-output
```

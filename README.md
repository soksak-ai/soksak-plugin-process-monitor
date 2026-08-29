# soksak-plugin-process-monitor

This plugin is a read-only sidebar consumer of the public `process.inventory` command. It never
scans the workstation, reads a terminal plugin's DOM, or infers ownership from an executable name.
The initial release renders the revisioned owner snapshots available at mount and through its
explicit `refresh` command. It does not poll; live process events will be added when Core publishes
the event surface.

The plugin has no runtime dependency on another plugin. Core's sidebar section API places it beside
the work, and the process contract supplies its data.

# Native hello-runtime startup measurements (F00-T02)

This spike measures the Bun compiled hello-runtime floor, workload `hello-v1`.
It does not initialize the agent, configuration, shell, provider, or TUI.
The approved `baseline.json`, absolute binary target, and permanent >20%
regression gate belong to F00-T08/T09; no baseline or target is set here.

## Method and reproduction

Use the repository's pinned Bun **1.4.2**, run `bun install --frozen-lockfile`,
then run the following from the repository root (use `hello.exe` on Windows):

```sh
bun build --compile spikes/boot.ts --outfile dist/hello
bun scripts/measure-perf.ts ./dist/hello hello-v1
```

The checked subprocess helper uses argv without a shell, hides Windows console
windows, captures output, and throws on nonzero exits or timeouts. Probes allow
10 seconds; the workflow's compile step allows 120 seconds.

- Run three discarded `--version` warmups, then 15 fresh child processes.
  Report the median wall time in milliseconds, including process launch,
  output capture, and exit. This is **OS-cache-warm process startup**, not a
  cold machine boot or TUI latency. OS caches are not flushed.
- Run five more fresh children with `LIZZY_PERF_PROBE=1`. Each child waits
  200 ms before reading its own `process.memoryUsage().rss`; report the median
  in bytes. This is a delayed child RSS snapshot, not peak RSS or the parent's RSS.
- Read the compiled artifact's actual byte length. Keep all 15 startup and five
  RSS samples in schema-version-1 measurement JSON.
- Identify OS/architecture, Bun, workload, and machine key. The hardware input
  is the sorted CPU model list (one entry per logical CPU) and total RAM bytes.
  Local keys additionally hash the hostname; raw local hostnames are never
  written to evidence. CI keys use the runner label and hardware hash without
  ephemeral hostnames. Image revision and OS release are audit metadata.
  Unknown runners and incomplete identities fail instead of sharing a fallback.

The [baseline workflow](../../.github/workflows/baseline.yml) compiles and runs
natively on `ubuntu-latest`, `windows-latest`, and `macos-latest`. It triggers
on PRs; manual dispatch becomes available after it reaches the default branch.
Each artifact contains `hello-measurement.json` and `environment.json`, including
the exact build argv, units, hardware, runner/image, and measured checkout SHA.
On a PR this SHA is the merge ref (`GITHUB_SHA`), not the branch head. Imports
in Actions' temporary Bun scripts use absolute file URLs from `process.cwd()`.

## Evidence

Native measurements are pending the first task PR run. Source-only unit tests
are protocol checks and are not evidence of a native compiled binary.
Results will retain the measured checkout SHA even when this report is updated
in a later documentation-only commit.

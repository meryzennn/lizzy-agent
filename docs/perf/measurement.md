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

The first two macOS attempts failed in `setup-bun` before compilation: the
official browser download URL returned HTTP 504. `gh release download` retrieved
the same official `bun-v1.4.2` asset through the release API; its SHA-256 matched
release asset 545329049 (`90987a3a16d7db556d886ac3d551e7b6d3edf0a1cf43acaed622e8676be1d12f`).
The macOS workflow uses this route, checks that digest and version, and requires
native ARM64. Updating the Bun pin also requires reviewing the asset checksum.
Linux and Windows retain `setup-bun` with `.bun-version`.

## Evidence — 8 November 2026

All three native jobs passed in [baseline run 42468777562](https://github.com/meryzennn/lizzy-agent/actions/runs/42468777562); [Linux/Windows checks](https://github.com/meryzennn/lizzy-agent/actions/runs/42468777564) also passed.
The measured checkout was PR #14's merge ref **`ab7a8a85ee31465c86a9e4c6a791abeb3a843a99`**, for branch head `dd04b66237062c9ffa18413dec6d90ac51d713f5` on base `b8a675462ffb33766875be3ecf7365c85ee79422`.
These records belong to that checkout; this later documentation-only update does not relabel them as measurements of its own commit.

| Native runner | Median startup (ms) | Median child RSS (bytes) | Binary (bytes) |
|---|---:|---:|---:|
| ubuntu-latest (linux/x64) | 11.594 | 25092096 | 81315296 |
| windows-latest (win32/x64) | 27.511 | 19873792 | 86087168 |
| macos-latest (darwin/arm64) | 20.081 | 14581760 | 62226930 |
| local Windows (win32/x64) | 48.507 | 22708224 | 86087168 |

The local Windows run used clean commit `d8732c948b3c03bd34cb08e8aff60f996b8af461`, OS release `10.0.22631`, 12 logical CPUs (AMD Ryzen 5 5500), and 17043591168 RAM bytes. Its toolchain was `C:/Users/RYZEN/.local/share/lizzy-agent/toolchains/bun-1.4.2/bun-windows-x64/bun.exe`. The workflow's compile/measure script was extracted and executed from a temporary file outside the checkout, exercising the absolute import paths. Local JSON files remain in ignored `dist/`; their exact content is preserved below.

Raw pairs below are copied from the downloaded artifacts, preserving full numeric precision. They retain the original file names inside each artifact. Median values, sample counts, schema/version/workload, matching metadata keys, and CI hardware hashes were independently recomputed and checked. Embedded copies preserve the evidence after Actions artifact expiry.

### ubuntu-latest

[Download raw JSON pair](https://github.com/meryzennn/lizzy-agent/actions/runs/42468777562/artifacts/13613000662).

`hello-measurement.json`

```json
{"schemaVersion":1,"key":"linux-x64-ci-ubuntu-latest-4356683604dd017b6088212653b433c760d8a36d81190bc3058397ff5838724c","bun":"1.4.2","workload":"hello-v1","metrics":{"versionMs":11.59375,"idleRssBytes":25092096,"binaryBytes":81315296},"samples":{"versionMs":[12.321861000000013,12.475785000000002,11.144408000000027,11.860320000000002,11.291449,11.594887999999997,11.59375,11.840180000000004,11.007594000000012,13.583152999999982,11.150527000000011,11.418249000000003,11.740921000000014,11.044178999999986,11.246336000000042],"idleRssBytes":[25092096,24969216,25153536,25112576,25026560]}}
```

`environment.json`

```json
{"key":"linux-x64-ci-ubuntu-latest-4356683604dd017b6088212653b433c760d8a36d81190bc3058397ff5838724c","runner":"ubuntu-latest","bun":"1.4.2","os":"linux","arch":"x64","osRelease":"7.0.0-1019-azure","cpuModels":["AMD EPYC 9V74 80-Core Processor","AMD EPYC 9V74 80-Core Processor","AMD EPYC 9V74 80-Core Processor","AMD EPYC 9V74 80-Core Processor"],"memoryBytes":16759439360,"image":"ubuntu26","imageVersion":"20261101.186.1","commit":"ab7a8a85ee31465c86a9e4c6a791abeb3a843a99","buildCommand":["/home/runner/.bun/bin/bun","build","--compile","spikes/boot.ts","--outfile","/home/runner/work/lizzy-agent/lizzy-agent/dist/hello"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"}}
```

### windows-latest

[Download raw JSON pair](https://github.com/meryzennn/lizzy-agent/actions/runs/42468777562/artifacts/13612676575).

`hello-measurement.json`

```json
{"schemaVersion":1,"key":"win32-x64-ci-windows-latest-715de114e5cccdbd9099a6f618a20d400c71e28e5758065b7d57693434fac86a","bun":"1.4.2","workload":"hello-v1","metrics":{"versionMs":27.511499999999955,"idleRssBytes":19873792,"binaryBytes":86087168},"samples":{"versionMs":[27.761100000000056,26.1943,26.769300000000044,26.542100000000005,26.684699999999907,27.04079999999999,26.01430000000005,26.85719999999992,27.511499999999955,36.82740000000001,59.5227000000001,35.42809999999997,29.682699999999954,29.43719999999996,27.79970000000003],"idleRssBytes":[19869696,19865600,19873792,19877888,19877888]}}
```

`environment.json`

```json
{"key":"win32-x64-ci-windows-latest-715de114e5cccdbd9099a6f618a20d400c71e28e5758065b7d57693434fac86a","runner":"windows-latest","bun":"1.4.2","os":"win32","arch":"x64","osRelease":"10.0.26100","cpuModels":["AMD EPYC 9V45 96-Core Processor","AMD EPYC 9V45 96-Core Processor","AMD EPYC 9V45 96-Core Processor","AMD EPYC 9V45 96-Core Processor"],"memoryBytes":17174360064,"image":"win25-vs2026","imageVersion":"20261103.298.1","commit":"ab7a8a85ee31465c86a9e4c6a791abeb3a843a99","buildCommand":["C:\\Users\\runneradmin\\.bun\\bin\\bun.exe","build","--compile","spikes/boot.ts","--outfile","D:\\a\\lizzy-agent\\lizzy-agent\\dist\\hello.exe"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"}}
```

### macos-latest

[Download raw JSON pair](https://github.com/meryzennn/lizzy-agent/actions/runs/42468777562/artifacts/13611973927).

`hello-measurement.json`

```json
{"schemaVersion":1,"key":"darwin-arm64-ci-macos-latest-8b3de9584821c8d462d2a77722e0ac7040e88cf701134a0eefe4272d7c161c5d","bun":"1.4.2","workload":"hello-v1","metrics":{"versionMs":20.080708000000186,"idleRssBytes":14581760,"binaryBytes":62226930},"samples":{"versionMs":[38.86337500000013,44.55391600000007,24.981915999999956,18.922458000000006,20.080708000000186,22.45049999999992,25.636124999999993,14.586000000000013,14.827583000000004,14.289416999999958,13.711334000000079,21.108625000000075,18.619915999999876,15.393624999999929,23.676917000000003],"idleRssBytes":[14598144,14598144,14581760,14581760,14581760]}}
```

`environment.json`

```json
{"key":"darwin-arm64-ci-macos-latest-8b3de9584821c8d462d2a77722e0ac7040e88cf701134a0eefe4272d7c161c5d","runner":"macos-latest","bun":"1.4.2","os":"darwin","arch":"arm64","osRelease":"25.6.0","cpuModels":["Apple M1 (Virtual)","Apple M1 (Virtual)","Apple M1 (Virtual)"],"memoryBytes":7516192768,"image":"macos26","imageVersion":"20261102.0473.1","commit":"ab7a8a85ee31465c86a9e4c6a791abeb3a843a99","buildCommand":["/Users/runner/work/_temp/bun-official/bun-darwin-aarch64/bun","build","--compile","spikes/boot.ts","--outfile","/Users/runner/work/lizzy-agent/lizzy-agent/dist/hello"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"}}
```

### Local Windows

`dist/hello-measurement.json`

```json
{"schemaVersion":1,"key":"win32-x64-local-fd20151120bdca8990221d9210c8acc3f01fd1898175038af2d68fd85c4bdddd","bun":"1.4.2","workload":"hello-v1","metrics":{"versionMs":48.50700000000006,"idleRssBytes":22708224,"binaryBytes":86087168},"samples":{"versionMs":[47.77929999999992,48.40819999999985,49.635699999999815,48.50700000000006,47.415700000000015,47.69629999999984,48.9208000000001,47.89059999999995,51.923300000000154,46.740200000000186,51.46129999999994,48.46569999999997,48.576499999999896,49.80479999999989,48.789999999999964],"idleRssBytes":[22712320,22708224,22708224,22814720,22708224]}}
```

`dist/environment.json`

```json
{"key":"win32-x64-local-fd20151120bdca8990221d9210c8acc3f01fd1898175038af2d68fd85c4bdddd","runner":"local","bun":"1.4.2","os":"win32","arch":"x64","osRelease":"10.0.22631","cpuModels":["AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500"],"memoryBytes":17043591168,"image":"local-windows","imageVersion":"10.0.22631","commit":"d8732c948b3c03bd34cb08e8aff60f996b8af461","buildCommand":["C:\\Users\\RYZEN\\.local\\share\\lizzy-agent\\toolchains\\bun-1.4.2\\bun-windows-x64\\bun.exe","build","--compile","spikes/boot.ts","--outfile","D:\\coding\\lizzy-agent\\dist\\hello.exe"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"}}
```

### Earlier attempts and limits

The first run ([42468248389](https://github.com/meryzennn/lizzy-agent/actions/runs/42468248389)) measured merge checkout `a4ac00cc59f4d714f34bcb7c389b83754588cd81` for head `d8732c948b3c03bd34cb08e8aff60f996b8af461`. Its [Linux pair](https://github.com/meryzennn/lizzy-agent/actions/runs/42468248389/artifacts/13612467726) and [Windows pair](https://github.com/meryzennn/lizzy-agent/actions/runs/42468248389/artifacts/13612358362) succeeded; macOS attempts 1 and 2 failed only during the official asset download (HTTP 504). Those failed attempts provide no macOS runtime evidence. The verified release API route above produced the later complete native run.

Hosted runner hardware changed between runs (EPYC 7763 to EPYC 9V74 on Linux; Xeon 8370C to EPYC 9V45 on Windows), and the keys changed accordingly. These values are observations for distinct machine classes, not a cross-machine regression comparison. Startup also includes scheduler, antivirus, and process-launch variability; the warmups do not remove all such effects. macOS is native ARM64, not an x64 comparison. No numerical target or approved baseline is inferred.

Validation: the new suite first failed with the measurement module absent, then all 13 new tests passed. Local `bun run check` passed (27 tests, 99 assertions); CI ran frozen installs and the normal checks without skipping tests. Existing sync-issues lint notices (one warning and two informational suggestions) remain unchanged. Source-only tests verify the protocol, not native binary performance. No agent/TUI performance, permanent regression gate, or later phase behavior is implemented or claimed.

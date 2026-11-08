# Native hello-runtime startup measurements (F00-T02)

This spike measures the Bun compiled hello-runtime floor, workload `hello-v1`.
It does not initialize the agent, configuration, shell, provider, or TUI.
The original evidence below remains unchanged. T09's measured baseline and
absolute cap proposals are documented in the appended section and require
`spec-change` review before adoption.

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

## T09 measured baseline proposal

T09 assembles eight actual records from T08: native hello and initialized-agent pairs on Linux, Windows, macOS ARM64 and local Windows. [baseline.json](baseline.json) preserves every original sample and full identity. [ADR-006](../adr/006-gerbang-performa.md#baseline-fase-0) lists the measured values and proposed byte caps; adoption remains subject to `spec-change` review.

### Inputs and audit

The three CI pairs come from [T08 run 42488687470](https://github.com/meryzennn/lizzy-agent/actions/runs/42488687470), checkout `f91a1bec1782af523b91adadc1fe3d75d9949039`. The GitHub commit API confirms parents `fa78cd66b0a5b36b390e9c8e2fbe70788983380b` and `23ff348cdd9d560144c691c5691515cedcfce4b1`. The local pair belongs to the latter head. Later numerical comparator changes did not alter the measured application. T09 does not relabel those SHAs as its own benchmark results.

Retained input root: `C:/Users/RYZEN/.local/share/lizzy-agent/reports/f00-t08-perf-checks/`. CI pairs are in `ci-native/baseline-{ubuntu,windows,macos}-latest/`; the local pair is in `windows-native/`. Each directory contains `hello-measurement.json`, `agent-measurement.json`, and `environment.json`. The resume audit revalidated the three CI file hashes against `ci-native/verified-pairing.json`, full key/Bun/workload pairing, 15 startup and five RSS samples, exact medians, native architecture, image, units, build argv and checkout provenance. CI hardware hashes were independently recomputed from sorted CPU models/core counts and total RAM; the local key was checked against this machine without publishing its hostname.

| Runner | Source artifact |
|---|---|
| ubuntu-latest | [13620925867](https://github.com/meryzennn/lizzy-agent/actions/runs/42488687470/artifacts/13620925867) |
| windows-latest | [13619564811](https://github.com/meryzennn/lizzy-agent/actions/runs/42488687470/artifacts/13619564811) |
| macos-latest | [13620113131](https://github.com/meryzennn/lizzy-agent/actions/runs/42488687470/artifacts/13620113131) |
| local Windows | Retained native pair and binary hashes in `windows-native/` |

The following environment records and SHA-256 digests preserve build and checkout evidence alongside the baseline after hosted artifacts expire. Raw measurements and samples are stored in `baseline.json`, with only the derived `binaryLimitBytes` added.

#### ubuntu-latest

Environment:

```json
{"key":"linux-x64-ci-ubuntu-latest-a87e82b151e5d0e51ce52729bbe6b0625cc3f34c07332ce4d8f1a5f146830e17","runner":"ubuntu-latest","bun":"1.4.2","os":"linux","arch":"x64","osRelease":"7.0.0-1019-azure","cpuModels":["AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor"],"memoryBytes":16759439360,"image":"ubuntu26","imageVersion":"20261101.186.1","commit":"f91a1bec1782af523b91adadc1fe3d75d9949039","eventCommit":"f91a1bec1782af523b91adadc1fe3d75d9949039","buildCommand":["/home/runner/.bun/bin/bun","build","--compile","spikes/boot.ts","--outfile","/home/runner/work/lizzy-agent/lizzy-agent/dist/hello"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"},"agentBuildCommand":["/home/runner/.bun/bin/bun","run","build"],"agentArtifact":"/home/runner/work/lizzy-agent/lizzy-agent/dist/agent","workloads":{"hello":"hello-v1","agent":"agent-f00-v1"}}
```

Input SHA-256:

```json
{
  "hello-measurement.json": "01f8662567d6badf7196cc5ed9bdea976f78e82440a6453257a33bb30d916e56",
  "agent-measurement.json": "f246fe1312a35e3c69beebe52e9a11216bf4d510ee0671acc6668812f81103de",
  "environment.json": "b1ab884b87a39e8fe7eae5832543a9acf349ca7b61082d5c1e3ae7bd28dfff3c"
}
```

#### windows-latest

Environment:

```json
{"key":"win32-x64-ci-windows-latest-9bc3985f61cc9b641f81804460042c55a88f521cd81857b156be6fdca03ae241","runner":"windows-latest","bun":"1.4.2","os":"win32","arch":"x64","osRelease":"10.0.26100","cpuModels":["AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor","AMD EPYC 7763 64-Core Processor"],"memoryBytes":17174360064,"image":"win25-vs2026","imageVersion":"20261103.298.1","commit":"f91a1bec1782af523b91adadc1fe3d75d9949039","eventCommit":"f91a1bec1782af523b91adadc1fe3d75d9949039","buildCommand":["C:\\Users\\runneradmin\\.bun\\bin\\bun.exe","build","--compile","spikes/boot.ts","--outfile","D:\\a\\lizzy-agent\\lizzy-agent\\dist\\hello.exe"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"},"agentBuildCommand":["C:\\Users\\runneradmin\\.bun\\bin\\bun.exe","run","build"],"agentArtifact":"D:\\a\\lizzy-agent\\lizzy-agent\\dist\\agent.exe","workloads":{"hello":"hello-v1","agent":"agent-f00-v1"}}
```

Input SHA-256:

```json
{
  "hello-measurement.json": "bf23c6e4c73e2e15cb3472515762b249e61602f7ebeae1103a48fa4431b4d9f3",
  "agent-measurement.json": "c0b6eb725fc2196bb480377d1a724d92fd677492ce1325522d5fb8faad8a1f70",
  "environment.json": "11730b8161da8ccd33b6126e2ad6e39eb04021eb07f3fadbfd58c3686d950921"
}
```

#### macos-latest

Environment:

```json
{"key":"darwin-arm64-ci-macos-latest-8b3de9584821c8d462d2a77722e0ac7040e88cf701134a0eefe4272d7c161c5d","runner":"macos-latest","bun":"1.4.2","os":"darwin","arch":"arm64","osRelease":"25.6.0","cpuModels":["Apple M1 (Virtual)","Apple M1 (Virtual)","Apple M1 (Virtual)"],"memoryBytes":7516192768,"image":"macos26","imageVersion":"20261102.0473.1","commit":"f91a1bec1782af523b91adadc1fe3d75d9949039","eventCommit":"f91a1bec1782af523b91adadc1fe3d75d9949039","buildCommand":["/Users/runner/work/_temp/bun-official/bun-darwin-aarch64/bun","build","--compile","spikes/boot.ts","--outfile","/Users/runner/work/lizzy-agent/lizzy-agent/dist/hello"],"units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"},"agentBuildCommand":["/Users/runner/work/_temp/bun-official/bun-darwin-aarch64/bun","run","build"],"agentArtifact":"/Users/runner/work/lizzy-agent/lizzy-agent/dist/agent","workloads":{"hello":"hello-v1","agent":"agent-f00-v1"}}
```

Input SHA-256:

```json
{
  "hello-measurement.json": "6b5d933a3a6e8406d83e32706bbc341d0449ff190ad6244fc9bccfc32a79cb8b",
  "agent-measurement.json": "d6143dd571ce7461ec5ecd61db829e30c7f1050c4cf3148a95c53f336b1d091e",
  "environment.json": "b6228d71a4dfcfee204113a8f2127115a8450067cdcbd57c0dc82619986e495f"
}
```

#### local

Environment:

```json
{"key":"win32-x64-local-fd20151120bdca8990221d9210c8acc3f01fd1898175038af2d68fd85c4bdddd","runner":"local","bun":"1.4.2","commit":"23ff348cdd9d560144c691c5691515cedcfce4b1","os":"win32","arch":"x64","osRelease":"10.0.22631","cpuModels":["AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500","AMD Ryzen 5 5500"],"memoryBytes":17043591168,"helloBuildCommand":["C:\\Users\\RYZEN\\.local\\share\\lizzy-agent\\toolchains\\bun-1.4.2\\bun-windows-x64\\bun.exe","build","--compile","spikes/boot.ts","--outfile","D:\\coding\\lizzy-agent\\dist\\hello.exe"],"agentBuildCommand":["C:\\Users\\RYZEN\\.local\\share\\lizzy-agent\\toolchains\\bun-1.4.2\\bun-windows-x64\\bun.exe","run","build"],"binarySha256":{"hello":"bfcd1304b5d0a518401e7ece7720bd25750f5ec6fb42fecc8bd16d6762040483","agent":"34b44fc31ea094ba2c2c7b9d60602b95b249d432d1221b71a616dff0da7dac5c"},"configuration":"Isolated empty home and working directory; real native shell resolution.","workload":"initialized skeleton","units":{"versionMs":"milliseconds","idleRssBytes":"bytes","binaryBytes":"bytes"}}
```

Input SHA-256:

```json
{
  "hello-measurement.json": "be5d6aaf6de53b74189233808fa4295d8368adf55e01b27d2e0128e44cee27ca",
  "agent-measurement.json": "1b7aa77eb1aca57c331677bb46b289e2de51a6dda4af646d8ba2990ffa4b7da4",
  "environment.json": "530631a6a01dc5dc995ac65fcee47ec28b43be95a2d49b60387e7a7c8a88eb9c"
}
```

### Assembly, limits and matching

Run `bun scripts/assemble-baseline.ts <hello.json> <agent.json> ...` from the repository root with the real retained files. It requires complete native Linux x64, Windows x64 and macOS ARM64 pairs on pinned Bun 1.4.2. Optional local Windows and additional CI hardware records must also be complete pairs. Every full key/Bun/workload tuple is unique; incorrect counts, medians, byte values, identities or pairings fail before writing. Creation uses exclusive `wx` mode, so an existing baseline cannot be overwritten even if another process creates it after the initial check. Further changes require explicit measured evidence and review.

The illustrative plan loop assumed exactly one hardware pair per CI class. The implemented minimum-six-record contract permits additional complete, independently measured hardware pairs because hosted fingerprints vary. It still selects exactly one record for a full key/Bun/workload; neither CPU model, core count, RAM nor identity is normalized. Uncovered hardware fails with its full key. Adding coverage requires native hello/agent evidence and environment/build/checkout provenance, rather than copying a nearby class or rerunning until a known runner appears.

Each absolute cap is the measured binary byte count times 1.2, rounded upward to a byte. This is a measured-data proposal with the same initial growth budget as the relative comparator. The independent absolute cap remains strict; the comparator retains its reviewed one-ULP correction only at the fractional 20% relative boundary. No guessed 60 MB ceiling or broad timing tolerance is used.

### Routine gate and local reproduction

The separate three-OS measurement workflow is preserved, including macOS's official release API download, SHA-256 check and exact Bun version/ARM64 checks. CI adds `perf (ubuntu-latest)` and `perf (windows-latest)`, each building a real native agent, measuring `agent-f00-v1` in an isolated empty home and working directory, and calling `checkPerformance`. The profile matches the retained empty initialized-skeleton workload, including native shell resolution. Temporary Actions scripts import repository modules through absolute file URLs. The comparator runs after measurement, so a missing, invalid or unmatched baseline still retains current measurements and diagnostic metadata in `perf-<runner>/perf-result.json`; comparison failures return a failing job without `continue-on-error`.

For local reproduction, use the pinned toolchain, build normally, then measure the absolute native binary while setting the measurement child environment's `HOME` and `USERPROFILE` to a newly created empty directory and using that directory as cwd. Call `measure([binary], binary, "agent-f00-v1", "local")`, save the JSON, and run `bun run perf <saved-measurement.json>` from the repository root. A plain `bun run perf` in a customized home/project can initialize a different configuration and is not the retained empty-skeleton benchmark.

Startup remains warm-cache process launch/exit timing, with three warmups and 15 retained samples. RSS remains five delayed child snapshots, taken 200 ms after config and shell initialization. For example, the retained local agent startup samples range from 64.4989 to 213.8613 ms while their median is 68.1508 ms; all samples remain available. These numbers do not measure peak RSS, model calls, interactive TUI latency or a cold OS boot. Timing noise and exact hardware coverage must be reviewed before making hosted gates required.

### T09 pipeline evidence

[PR #21](https://github.com/meryzennn/lizzy-agent/pull/21) first ran the explicitly
marked synthetic injection at head `3ebd08d5bb025cbf5a31ac7a9bdd94c382e08256`,
measured merge checkout `84c471fdefd1d5b452d34c77264121ed19d1a8f5`.
The [Windows perf job](https://github.com/meryzennn/lizzy-agent/actions/runs/42508001792/job/128814723104)
failed with `binaryBytes: 104377349.11999999 bytes exceeds 120% of baseline
86262272 bytes` and the independent absolute cap of `103514727` bytes.
The injected value is exactly the matching reference times 1.21. The artifact
separately preserves the actual native measurement: startup 44.5105 ms, child
RSS 27684864 bytes, binary 86262272 bytes. This proves pipeline failure
propagation; it is not an observed application regression. The next commit
removes the injection and leaves the baseline unchanged.

The [Linux perf job](https://github.com/meryzennn/lizzy-agent/actions/runs/42508001792/job/128814722877)
failed before injection because its full key was uncovered:
`linux-x64-ci-ubuntu-latest-de1a12e4f64fc5690f478bcc56157683549c74fb265a3c4ad93b859610a17b3b`.
It had four `INTEL(R) XEON(R) PLATINUM 8573C` CPUs and 16758398976 RAM bytes.
The separate [native measurement run](https://github.com/meryzennn/lizzy-agent/actions/runs/42508001861)
used another Linux key,
`linux-x64-ci-ubuntu-latest-e9c2dfd08a0b7b068113caa881c99560f7f7aa4b8b8fdc899b4fd25316afbc09`,
four `Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz` CPUs and 16758403072
RAM bytes. Its actual complete pair is retained as candidate evidence, not
substituted for either the approved-key reference or the uncovered job's key.
The perf artifacts retain measurements and errors even when matching fails.

### Bounded collection of uncovered hardware

After the normal run also failed on uncovered Linux and Windows hardware, the
coordinator authorized one bounded collection cycle followed by one clean
validation cycle. An uncovered perf job now compiles hello natively in that
same job and measures it in the same isolated empty home/cwd as the initialized
agent. It verifies the full key and Bun agree, then retains the pair as
`perf-candidate.json` with status `unapproved`. The job still fails through the
normal comparator. Missing/invalid baselines and real regressions remain failures;
collection never writes a baseline or supplies a fallback.

Candidate provenance includes exact native build argv, measured checkout/event
SHA, image and hardware, artifact SHA-256, hashes of tracked runtime source and
build inputs, declared dependencies and installed Zod version. Before staging
new coverage, these inputs must match the T08 reference application at
`23ff348cdd9d560144c691c5691515cedcfce4b1` (the measured merge checkout's head).
A separate candidate baseline and append-only semantic diff preserve every
existing row and cap. Coverage proposals must not come from changed application
code or raise a matching reference to clear a regression. Any further unknown
hardware or real regression after the single validation cycle requires a
stable-runner/policy decision rather than another collection/rerun loop.

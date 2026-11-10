# ADR-007: Paired native CI reference selection

- **Status:** Accepted direction by user authorization, 9 November 2026; documentation adoption through a `spec-change` PR. Implementation and native CI validation remain pending in [#9](https://github.com/meryzennn/lizzy-agent/issues/9).
- **Ditinjau di:** Fase 0, T09
- **Partially replaces:** [ADR-006](006-gerbang-performa.md), CI reference selection only.

## Konteks

T09 [PR #21](https://github.com/meryzennn/lizzy-agent/pull/21) at `e022b6f115c5c0024b3de1842694322e12320ed0` cannot compare hosted runners whose exact CPU/core/RAM key is absent from historical samples. Additional rows or an OS image pin cannot guarantee the next hosted hardware identity. The user authorized measuring immutable T08 and the candidate on the same native runner, keeping exact identities, the 20% threshold and fixed binary caps.

## Keputusan

### Reviewed policy and trust

[docs/perf/ci-reference.json](../perf/ci-reference.json) is the versioned policy input. Its complete version-1 schema is a strict JSON object with exactly these fields; every field is required, and unknown fields/versions, wrong types or missing values fail:

| Field | Type and approved value |
|---|---|
| `schemaVersion` | Integer, `1` |
| `repository` | String, `meryzennn/lizzy-agent` |
| `referenceCommit` | String, full lowercase 40-hex SHA `61d868f200f4c9e99a54388603ef0c6098a255c1` (merged T08) |
| `bun` | String, `1.4.2` |
| `workload` | String, `agent-f00-v1` |
| `binaryLimitBytes` | Strict object with exactly `linux-x64: 97784794` and `win32-x64: 103514727`; positive integer byte counts |

The caps are the existing T09 proposed values, now part of the authorized policy. They are independent limits, never recalculated from a job's reference or candidate binary. The fixed comparator threshold remains >20% for each of `versionMs`, `idleRssBytes` and `binaryBytes`; exactly 20% passes subject to the independent cap. There is no configurable threshold field.

For `pull_request`, read policy bytes from the exact event `pull_request.base.sha` in the base repository `meryzennn/lizzy-agent`. For a push to `main`, use the immutable event `before` revision (previous `main`), never the pushed candidate revision. Reject missing, all-zero, malformed or unavailable policy revisions and missing policy, including before this prerequisite is merged; there is no fallback to candidate files, mutable `main`, proposal constants or historical rows. Record and verify the resolved full policy commit and file hash. Policy-source movement is distinct from the fixed T08 application/harness reference: the reference SHA never follows `main`, the PR base or candidate automatically. Resolve and verify reference and candidate source revisions separately, recording event, head, base and measured checkout/merge SHAs when applicable.

Load `measure()`, `checkPerformance()` and their transitive harness imports from the pinned reference checkout and its frozen dependencies. Candidate edits to policy, measurement or comparison code must not select the active reference, caps or comparator. Keep a normal `pull_request` workflow, without write-enabled `pull_request_target` execution. Sharing a VM with candidate build/runtime code is **not hostile-code isolation**; this design does not claim adversarial tamper resistance.

### Build, measure and compare

1. Fetch reference and candidate into separate directories. Select Bun from trusted policy, verify the executing Bun and both revisions' Bun pins equal 1.4.2, and use each revision's own `bun install --frozen-lockfile`, then build both native artifacts before measuring either. Candidate dependency changes are allowed; record both sets of inputs rather than requiring identical hashes.
2. In each native Linux x64 or Windows x64 job, measure the reference first and candidate second, sequentially on that job's runner. Use distinct absolute artifact paths and separate empty runtime working directories and user profiles with equivalent environment settings. Neither checkout's project config nor the runner's personal config may influence initialization; validate isolation on both OSes.
3. Preserve the pinned harness protocol: three discarded startup warmups, all 15 fresh-process `--version` samples, all five initialized child RSS samples after 200 ms, medians, and actual binary byte length. Startup is OS-cache-warm process startup, not machine cold boot or TUI latency.
4. Require exact equality of the complete hardware key, Bun and workload between the two measurements, and Bun/workload equality with policy. Keep OS/architecture, runner label, full sorted CPU-model list per logical CPU and total RAM in identity; do not round, normalize or drop identity fields. Unknown historical hardware is allowed only when this genuine pair matches.
5. Reuse pinned `checkPerformance()` with a temporary in-memory baseline entry made from this job's reference measurement and the fixed platform cap. Fail on >20% in any metric or binary bytes above the cap, independently. Never write the paired measurement into historical `baseline.json`.
6. Fail on missing/invalid policy, unavailable reference or cap, fetch/install/build/probe failure, incomplete samples, identity mismatch or comparison failure. Preserve nonzero exit status and available diagnostics. No fallback, sample dropping, lucky reruns, automatic reference advancement or threshold relaxation is allowed.

### Evidence and acceptance

Initialize stage/outcome evidence at a stable path outside both build directories before fallible setup. Retain both completed raw sample sets and medians; policy repository/revision/file hash; reference, candidate and harness revisions; exact install/build argv; source/build-input, dependency/lockfile and binary hashes; environment, runner/image and isolation metadata; comparison output and available failure details. Early checkout/toolchain/install/build failures must retain stage, role, outcome and available diagnostics with Actions logs; upload available evidence unconditionally and preserve nonzero status. Keep a completed reference result if the candidate fails. Pinned `measure()` returns arrays only on success: a mid-probe exception cannot supply partial raw samples, so record that absence and the error without reconstructing samples. Never relabel old measurements as new runs or overwrite failed evidence with a later success.

T09 must test distinct artifacts (catch measuring the candidate twice), both event policy sources and invalid revisions, trusted policy/harness selection despite candidate edits, exact identity checks including new matching hardware, empty profiles/cwds, missing policy/reference/caps, and retained early setup/build/probe failures. Test exactly 20%, 21% for every metric and independent cap failure through the entrypoint, retaining existing comparator tests. Native Linux and Windows CI must each demonstrate a deliberate regression failure and a subsequent clean comparison with retained evidence; label injected comparator inputs separately from original native measurements. Local feasibility or synthetic comparator fixtures alone are insufficient.

## Konsekuensi

CI replaces the T09 unknown-hardware coverage-collection path with paired measurement; it does not try historical lookup first or collect rows until a failed comparison passes. Preserve historical `docs/perf/baseline.json`, raw evidence and the three-OS hello/agent record. Local `bun run perf [measurement-file.json]` keeps the frozen-baseline contract, including failure for missing data or an unmatched identity. This prerequisite adds no baseline samples or runtime implementation.

The initial Windows feasibility experiment on 9 November 2026 compared the exact T08 reference and PR #21 head above: startup medians 57.912600/56.626700 ms, child RSS 30261248/30265344 bytes, and 86262272-byte binaries on both sides, with no comparator failures. The original `proposal.md`, `probe.ts` and `result.json` remain in the local report directory `f00-t09-reference-pair-2026-11-09`. Their original proposed/unapproved labels describe that historical experiment; the later authorization does not rewrite them. It used a shared empty cwd and does not prove separate-profile isolation or native CI acceptance.

Same-job pairing removes cross-machine mismatch, but scheduler, antivirus and measurement-order noise remain. Implementation and local verification may proceed while this docs PR awaits user merge, using an explicit separate policy fixture or exact prerequisite checkout and labeling results as local pre-adoption validation. Native CI activation must read policy from the real reviewed event base defined above and fail if it is absent; a local fixture is not a production fallback. After user merge, refresh T09 against that base and obtain a new event with the correct immutable policy revision. Merges, protection changes, milestone closure, releases and T10 remain user-controlled and pending.

## Ditinjau ulang bila

Changes to repository/reference, Bun, workload, sampling/order, identity, caps or threshold require a new reviewed `spec-change` and user authorization. If hosted pairing is too noisy, review dedicated native runners or a specified measurement protocol with all failed evidence preserved; do not tune or rerun until green.

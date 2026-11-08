# ADR-006: Gerbang performa sejak Fase 0

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Budget performa (cold start, RSS, ukuran binary) semula baru jadi gerbang di Fase 15, setelah semua dependensi masuk. Ukuran binary kosong `bun build --compile` sendiri belum pernah diukur, jadi target 60 MB adalah tebakan.

## Keputusan

Fase 0 mengukur baseline hello-world di Linux, Windows, dan macOS ke `docs/perf/baseline.json`. CI menjalankan job perf di setiap PR: waktu `--version`, idle RSS, ukuran binary; regresi >20% dari baseline = merah. Target absolut binary ditetapkan dari baseline. Latensi TUI masuk gerbang di Fase 9.

## Konsekuensi

Setiap dependensi runtime baru harus dibenarkan di issue. Memperbarui baseline butuh persetujuan user di PR berlabel `spec-change`.

## Ditinjau ulang bila

Variasi runner CI terlalu besar sehingga gerbang 20% sering merah palsu; ganti ke median beberapa run atau runner tetap.

## Baseline Fase 0

T09 proposes the actual T08 native pairs in [baseline.json](../perf/baseline.json),
pending `spec-change` review. Bun is 1.4.2 for every record. These are the initial
budgets for the initialized skeleton; the hello runtime floor remains alongside
each agent record.

| Runner | Workload | Median startup (ms) | Median child RSS (bytes) | Binary (bytes) | Proposed absolute cap (bytes) |
|---|---|---:|---:|---:|---:|
| ubuntu-latest | hello-v1 | 16.482519 | 25214976 | 81315296 | 97578356 |
| ubuntu-latest | agent-f00-v1 | 22.318910 | 40914944 | 81487328 | 97784794 |
| windows-latest | hello-v1 | 41.445400 | 19898368 | 86087168 | 103304602 |
| windows-latest | agent-f00-v1 | 49.076000 | 27697152 | 86262272 | 103514727 |
| macos-latest | hello-v1 | 11.724167 | 14565376 | 62226930 | 74672316 |
| macos-latest | agent-f00-v1 | 16.036875 | 24444928 | 62392050 | 74870460 |
| local Windows | hello-v1 | 64.469700 | 23322624 | 86087168 | 103304602 |
| local Windows | agent-f00-v1 | 68.150800 | 30715904 | 86262272 | 103514727 |

The proposed cap is `ceil(measured binary bytes * 1.2)` for each record. This
allows the same initial 20% growth budget as the relative gate, rounded upward
to an integer byte; the independent absolute comparison stays strict. A 60 MB
cap would reject the measured runtime floor on every platform. Adoption and any
later change require review of actual measurements, rather than raising a cap
to clear a failed job.

The [T08 native run](https://github.com/meryzennn/lizzy-agent/actions/runs/42488687470)
measured checkout `f91a1bec1782af523b91adadc1fe3d75d9949039`, with base
`fa78cd66b0a5b36b390e9c8e2fbe70788983380b` and head
`23ff348cdd9d560144c691c5691515cedcfce4b1`. The local Windows pair measured that
head. These identities are preserved; the measurements are not attributed to
the T09 commit. [Measurement details and provenance](../perf/measurement.md#t09-measured-baseline-proposal)
retain the runner fingerprints, environment records, artifact hashes and limits.

Startup is the median of 15 fresh processes after three discarded warmups with
warm OS caches. RSS is the median of five child snapshots, 200 ms after the
agent has loaded configuration and resolved its shell. It is neither peak RSS
nor TUI latency. Raw samples remain in the baseline; outliers are not discarded.
Routine gates run `agent-f00-v1` in an empty home and working directory.

Following the bounded same-job collection, T09 also proposes four additional
complete hardware pairs, bringing the baseline to 16 entries. All initial rows
and caps above are preserved exactly. The additional rows use source, native
build inputs and installed dependencies proven equivalent to the measured T08
application; the [append-only coverage proposal](../perf/measurement.md#append-only-coverage-proposal)
records their values and provenance. New agent caps remain 97784794 bytes on
Linux and 103514727 on Windows. A separate unapproved candidate file and semantic
diff precede the explicit PR edit. Finite observed coverage does not establish
stable hosted hardware; unknown keys continue to fail and require a runner or
identity-policy decision if they persist after the bounded validation cycle.

Full OS/architecture/runner/hardware key, Bun and workload must match exactly.
Unknown hardware fails closed. Several evidence-backed complete pairs can cover
a CI runner class, but identities are never combined or normalized. CPU/core/RAM
variation and timing noise can therefore block a hosted runner; investigate and
review new native pairs or runner policy before adoption if the gate is unstable.

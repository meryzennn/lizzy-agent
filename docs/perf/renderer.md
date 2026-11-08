# F00-T03 renderer comparison

Evidence collection is in progress. ADR-003 remains the accepted differential-renderer design; the package-versus-owned choice will be recorded after native Windows and Linux runs.

The private spike pins `@earendil-works/pi-tui@1.5.0` (MIT, upstream `e49b1495045f06643a7cc4c93330fabc2ab37ce4`, declared Node >=22.19) and Bun 1.4.2. Production dependencies are unchanged. Both implementations use the same `Transcript.render(width): string[]` ASCII fixture, 34 ms streaming interval, 120-column viewport, and 100 single-character inputs at 70 ms intervals with Enter every 50 characters. Each mode runs with Escape and Ctrl+C separately, resizing 120 -> 80 -> 120 after submission. Final native binaries run in a temporary directory outside the repository and node_modules.

The metric is raw stdin event receipt to return from the stdout write containing that input's complete echo. It includes pi input buffering and render scheduling, excludes transport before stdin receipt and physical screen paint, and does not count stream-only writes. The probe removes CSI formatting and OSC hyperlink resets, treats cursor/erase operations as line boundaries, and rejects prefix-only matches. Samples stay in arrival order; p95 uses nearest rank. This is not the Phase 9 PTY latency gate.

The file list is refined with one focused `spikes/renderer/pty-harness.py` and `.github/workflows/renderer-spike.yml` to collect native Linux evidence from the Windows development host. The coordinator also approved changing only root `scripts.test` from `bun test test` (a substring filter that accidentally includes the spike) to `bun test ./test` (the explicit directory). This preserves all 27 root tests and runs the 10 spike tests in their own workflow with the private dependency installed. Windows uses installed pywinpty 2.0.15 with ConPTY; Linux uses Python's standard PTY library. No test framework or production feature is added. The harness stores raw PTY bytes as UTF-8 logs, stderr including sample JSON, console/termios snapshots, commands, sizes and SHA-256 digests. It checks terminal mode restoration, final cursor/alternate-screen/paste/keyboard/synchronized-output control sequences, normal exits and injected lifecycle failures.

Mechanical corrections to the plan example: initialize timer state before cleanup can run; use shared ASCII components to keep fixture behavior identical; handle resize explicitly; restore terminal/listener/observer state in `finally`; match pi exit controls with `matchesKey`; keep shared comparison code free of pi imports; handle OSC resets and cursor boundaries in the echo probe. A Windows no-op control showed `rtk run -c`'s cmd shell changes console input mode 503 to 487 before renderer startup, so snapshots are taken inside that initialized launch shell around the actual candidate process. The original mismatch was not attributed to either renderer.

Reproduction from the repository root (PowerShell, no global PATH changes):

```powershell
rtk proxy C:/Users/RYZEN/.local/share/lizzy-agent/toolchains/bun-1.4.2/bun-windows-x64/bun.exe install --cwd spikes/renderer --frozen-lockfile
rtk proxy C:/Users/RYZEN/.local/share/lizzy-agent/toolchains/bun-1.4.2/bun-windows-x64/bun.exe test spikes/renderer/compare.test.ts
rtk proxy python spikes/renderer/pty-harness.py --bun C:/Users/RYZEN/.local/share/lizzy-agent/toolchains/bun-1.4.2/bun-windows-x64/bun.exe --rtk C:/Users/RYZEN/.local/bin/rtk.exe --output C:/Users/RYZEN/.local/share/lizzy-agent/reports/renderer-windows
```

Linux CI installs the private frozen lockfile, runs the focused tests and harness self-check, then runs `python3 spikes/renderer/pty-harness.py --output dist/renderer-linux`. Interactive candidate streams inherit a real PTY; CI invokes installed tools directly. Each backend is bundled with `bun build <backend>-entry.ts --target=bun --outfile <backend>-spike.js` and compiled with the same flags plus `--compile` (native `.exe` suffix on Windows). Neither build uses minification. Exact absolute commands and artifact hashes are in `environment.json`.

The spike intentionally excludes a full editor, themes, Unicode, scrollback, physical display timing, and macOS. Enhanced pi exit-key encodings are covered by unit tests; native runs use legacy character/control bytes, with pi keyboard negotiation recorded in the raw log. Optional clipboard and modifier features outside this workload are not implied by successful ASCII sessions.

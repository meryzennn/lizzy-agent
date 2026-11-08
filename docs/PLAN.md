<!-- Versi Markdown dari docs/PLAN.html untuk dibaca Claude Code. Jika berbeda, PLAN.html yang berlaku. -->

Plan Final · Superpowers Writing-Plans

# Coding agent sendiri, dibangun per fase.

Satu CLI coding agent open-source ala Claude Code dan Codex yang **provider-agnostic**: jalan di atas endpoint OpenAI-compatible dan Anthropic Messages mana pun, dengan **9Router sebagai preset kelas satu** (termasuk model Antigravity `ag/*` lewat 9Router), plus pembeda yang belum ada dalam bentuk terintegrasi di agent pasaran: **hard budget**, **combo fallback bernama yang bisa diatur sendiri**, **verification gate**, dan **saran ganti model berbasis frustrasi user**. Dashboard **`/stats` lokal ala Oh My Pi** (usage per model, RAM proses, frustrasi per model) masuk sebagai fase observability tersendiri. Terakhir, **Discord Rich Presence yang lengkap** masuk sebagai fase: status agent (working, waiting approval, planning, orchestrating), model, token, dan timer sesi tampil di profil Discord user lewat IPC lokal, dengan kontrol privasi per field sejak hari pertama. Penutupnya, **appearance dan status line kelas satu ala Oh My Pi/Pi** (Fase 15): tema JSON ±38 token — 5 bawaan plus file user dan proyek dengan hot reload, slot dark/light terpisah — status line dua lapis (segmen yang bisa diatur sendiri plus hook perintah eksternal kompatibel Claude Code, termasuk segmen sisa budget yang tidak dimiliki agent mana pun), dan **budget performa tertulis yang dites di CI** supaya klaim “ringan” itu terukur: cold start \<300 ms, idle RSS \<100 MB, dan ukuran binary yang targetnya ditetapkan dari baseline terukur di Fase 0. **Revisi 8 Nov 2026** mengunci enam keputusan arsitektur dan menambal lubang di inti agent — lihat bagian R.

Fase: **0 sampai 15** Rilis: **v0.1 → v0.7** Stack: **TypeScript + Bun-only** Revisi: **8 Nov 2026** Gaya: **tugas kecil, bukan one-shot**

## R Revisi 8 Nov 2026: keputusan yang dikunci

Review atas versi sebelumnya menemukan bagian yang saling bertabrakan dan lubang di inti agent. Revisi ini mengunci enam keputusan sebelum baris kode pertama, memperbaiki kontradiksi, dan menambah tugas yang hilang. Tugas yang berubah ditandai \[diubah\] , tugas baru \[baru\] . Riset A2–A4 dibiarkan sebagai catatan riset; bila angkanya bertabrakan dengan bagian ini, bagian ini yang berlaku.

### Keputusan arsitektur (ADR), ditinjau ulang dengan data spike di Fase 0

| Keputusan                | Pilihan                                                                                                                                                                                                     | Alasan                                                                                                                                                                                                                          |
|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ADR-001 Runtime          | **Bun-only.** Klaim kompatibel Node ≥22 dicabut.                                                                                                                                                            | Plan sendiri memakai `Bun.serve`, `bun:sqlite`, `bun:jsc`, dan `Bun.connect`, tanpa CI Node. Distribusinya binary `bun build --compile`, jadi kompatibilitas Node tidak membeli apa pun.                                        |
| ADR-002 Lapisan model    | **Adapter HTTP sendiri** (`fetch` + parser SSE) untuk OpenAI Chat Completions dan Anthropic Messages. Vercel AI SDK tidak dipakai.                                                                          | Format kanonik sudah milik kita; AI SDK menambah lapis konversi ketiga dengan risiko thinking signature dan field khusus provider hilang. Dua protokol cukup kecil untuk ditulis sendiri dan lebih ringan untuk budget startup. |
| ADR-003 Renderer TUI     | **Renderer diferensial model pi-tui** (`render(width): string[]`, diff baris, CSI 2026). Ink tidak dipakai. Spike Fase 0 memutuskan: paket pi-tui langsung atau tulis sendiri.                              | Model render Ink (reconciler React + Yoga yang menggambar ulang area dinamis) bertentangan dengan target latensi dan scrollback committed. Keputusan ini harus jatuh sebelum Fase 9, bukan dibongkar di Fase 15.                |
| ADR-004 Shell di Windows | Tool `bash` memakai **Git Bash** (dideteksi; path bisa disetel di config). Tanpa Git Bash: pesan error jelas berisi cara instal. Tool PowerShell native masuk backlog.                                      | Satu dialek shell untuk model di semua OS, dan parser izin cukup satu grammar (tree-sitter-bash).                                                                                                                               |
| ADR-005 Format config    | **JSONC** untuk semua config (global + proyek), divalidasi zod. Tema tetap JSON.                                                                                                                            | Versi lama mencampur JSON, TOML, dan YAML. Satu format, tanpa dependensi parser tambahan.                                                                                                                                       |
| ADR-006 Gerbang performa | **Diukur sejak Fase 0**: waktu `--version`, idle RSS, dan ukuran binary per OS, dengan baseline di repo dan gerbang regresi \>20% di CI. Target absolut binary ditetapkan dari baseline hello-world Fase 0. | Regresi yang baru ketahuan di Fase 15 mahal dibongkar. Binary kosong `bun build --compile` sendiri sudah berukuran puluhan MB atau lebih tergantung platform, jadi angka 60 MB tidak boleh ditebak.                             |

### Kontradiksi yang diperbaiki

- **Retry Fase 6**: tidak ada lagi retry 10× dengan backoff sampai 300 detik sebelum fallback. Retry pendek, hormati `Retry-After`, lalu pindah entri.
- **Ink vs pi-tui**: diselesaikan ADR-003; Fase 9 dan 15 diselaraskan.
- **LSP**: dihapus dari Fase 2, 12, dan 15. Diagnostik pasca-giliran memakai perintah per proyek dari config; klien LSP masuk backlog.
- **API ekstensi tanpa sistem ekstensi**: `setStatus`/`setWidget` di Fase 15 menjadi API internal untuk modul sendiri; sistem ekstensi pihak ketiga masuk backlog.
- **Klaim pembeda di bagian E**: disesuaikan dengan riset sendiri (fallbackChains OMP, LiteLLM, Stop hook Claude Code).
- **Memory lintas proyek**: dikeluarkan dari daftar “yang dibangun”; tetap di backlog F.
- **Path pipe Discord**: spike menguji `\\.\pipe\` dan `\\?\pipe\`; transport memakai bentuk yang lolos.

### Lubang yang ditambal

- **Verification gate tahan bypass lewat bash**: runner meng-hash file terlindungi dan config test (Fase 7).
- **Normalisasi transkrip saat ganti model**: thinking bersignature, ID tool call, compaction pra-pindah, gagal di tengah streaming (Fase 6).
- **Masalah Windows yang nyata**: CRLF, path, kill pohon proses, Git Bash (Fase 0 dan 2).
- **REPL minimal + headless dasar** di Fase 2, supaya v0.1 bisa dipakai sebelum TUI Fase 9.
- **Checkpoint file dan `/rewind`** (Fase 2).
- **Eval harness dengan model asli** + system prompt dan deskripsi tool berversi (Fase 2 dan 4).
- **Katalog metadata model** (snapshot models.dev + override) dan pencatatan model aktual dari respons (Fase 1).
- **Redaksi secret** di transkrip dan export (Fase 5); **keamanan dashboard** lewat cek Host/Origin + token (Fase 12).
- **Leksikon frustrasi per bahasa**, minimal Inggris + Indonesia (Fase 13).
- **Budget default berbasis token dan giliran**; dolar opsional, karena model langganan via 9Router tidak punya harga (Fase 6).

Alur eksekusi juga berubah: file MD per fase ditulis tepat sebelum fasenya dimulai (bukan 16 sekaligus), dan status kerja dilacak di GitHub Issues. Lihat bagian G.

## A Arsitektur yang direncanakan

Diringkas dari enam riset (anatomi agent modern, 9Router dan Antigravity, orchestration, riset penutup di bagian A2, riset Discord RPC di bagian A3, dan riset appearance/status line/profil ringan Oh My Pi dan Pi di bagian A4). Ini fondasi yang dipakai semua fase di bawah.

### Loop dan pesan

- **Loop manual satu langkah model per putaran** (pola OpenCode `SessionPrompt.loop()`): rakit konteks, panggil model sekali, cek izin, eksekusi tool, potong hasil, ulangi. Di sela langkah bisa disisipkan permission check, budget check, compaction, dan checkpoint file (Fase 2).
- **Format pesan kanonik internal bergaya Anthropic**: blok terurut text, tool_use, tool_result, thinking. Adapter HTTP sendiri (ADR-002) menerjemahkan ke dan dari OpenAI Chat Completions dan Anthropic Messages, termasuk normalisasi transkrip saat model berganti di tengah sesi (Fase 6).
- **Sesi = JSONL append-only** yang formatnya didokumentasikan, bisa resume, fork, export, dan import. Catatan mentah per pesan (termasuk pesan user dan record usage per request) adalah satu-satunya sumber data untuk dashboard stats dan frustrasi nanti — agregat selalu turunan, tidak pernah instrumentasi ulang.
- **Observability = rollup SQLite di atas JSONL itu** (pola omp-stats): sinkronisasi inkremental berkursor ke `bun:sqlite`, rollup per jam, dashboard disajikan server HTTP lokal Bun. Statistik RAM proses/mesin adalah lapis terpisah yang di-sampling berkala, bukan dari transkrip.
- **Subagent = fungsi dengan context segar** yang mengembalikan ringkasan. Orchestration di fase akhir meminjam model state Run/Task/Dispatch punya Orca, disimpan di SQLite.
- **Discord RPC = modul in-process yang diberi makan event loop**, bukan polling dan bukan daemon terpisah: `session.started`, `tool.started/finished`, `approval.requested/resolved`, `usage.updated`, `worker.spawned/exited`, `session.ended`. Modul ini bicara ke Discord desktop lewat IPC lokal dan gagal diam-diam bila Discord tidak jalan; ia tidak pernah boleh mengganggu loop.
- **Appearance = tema JSON ala Pi yang dipangkas + status line dua lapis** (Fase 15): satu file JSON per tema (`vars` + `colors` ±38 token + `export` opsional), slot `theme.dark`/`theme.light` terpisah, dan status line yang lapis pertamanya segmen terkonfigurasi (termasuk segmen sisa budget dari Fase 6) dan lapis keduanya hook perintah eksternal ber-JSON kompatibel Claude Code. Rendering diferensial + CSI 2026 membuat keduanya murah; budget performanya tertulis dan dites, bukan klaim.

### Provider dan 9Router

- **Provider didefinisikan sebagai blok config** (pola OpenCode): id, baseURL, apiKey dari env, daftar model, dan override context window per model.
- **Override context window WAJIB menang atas klaim router.** 9Router melabeli model custom 200k padahal aslinya bisa cuma 131k; kalau klaim router yang menang, sesi bakal meledak di tengah jalan.
- **Preset 9Router bawaan**: baseURL `http://localhost:20128/v1`, model `ag/*` (Antigravity), `kr/*`, dan lain-lain terdokumentasi. Login Antigravity diurus 9Router, agent ini tidak menyentuh OAuth sama sekali.
- **Combo = model virtual bernama di file config** (Fase 6): nama combo bisa ditulis di mana pun penyeleksi model bisa ditulis (termasuk mengisi role seperti `default` atau `smol`), isinya daftar terurut `provider/model` yang bebas mencampur provider — gabungan pengemasan 9Router dan mekanik `retry.fallbackChains` OMP, tapi bisa diedit sebagai file config JSONC biasa (ADR-005), bukan dashboard-only.

&nbsp;

    {
      "provider": {
        "9router": {
          "baseURL": "http://localhost:20128/v1",
          "apiKey": "{env:NINEROUTER_API_KEY}",
          "models": {
            "ag/claude-sonnet-4-6": { "context": 200000 }
            // override per model di sini menang atas label router
          }
        }
      }
    }

### Tech stack

\[diubah\] **TypeScript + Bun-only** (ADR-001): Bun untuk dev, test, dan `bun build --compile` untuk binary; akses OS tetap lewat modul tipis supaya mudah diuji. **Adapter HTTP sendiri** untuk OpenAI-compatible dan Anthropic Messages (ADR-002), tanpa Vercel AI SDK. `@modelcontextprotocol/sdk` untuk MCP, di-lazy-import. ripgrep dibundel per platform. `web-tree-sitter` (WASM, bukan addon native) untuk parsing perintah bash di izin, dimuat malas; repo map tetap opsional. Hitung token: heuristik + kalibrasi dari `usage` respons; `js-tiktoken` opsional dan dimuat malas. **Renderer TUI diferensial model pi-tui** (ADR-003), bukan Ink. zod untuk skema; config **JSONC** (ADR-005). Shell tool di Windows: **Git Bash** (ADR-004). Metadata model (context window, harga, kapabilitas) dari snapshot `models.dev` yang dibundel + override lokal. `git` dipanggil sebagai proses.

## A2 Riset penutup: `/stats`, RAM, frustrasi, combo

Tiga pertanyaan terakhir dijawab dari riset 7–8 Nov 2026 atas Oh My Pi (`can1357/oh-my-pi`, fork keras dari Pi-nya Mario Zechner), 9Router, dan port frustrasi ke OpenCode. Ini yang mengubah plan dari 12 fase menjadi 14 fase (0–13).

### 1. `/stats`-nya Oh My Pi: beneran Bun, beneran server lokal

- **Cara jalan:** `omp stats` di shell atau `/stats` di dalam sesi membuka dashboard web lokal yang sama, default `http://localhost:3847`, bind default `127.0.0.1`; opsi `--port` dan `--host` ada. Mode tanpa dashboard: `omp stats --summary` dan `--json`.
- **Link IP lokal yang kamu lihat** (mis. `192.168.x.x:3847`) itu server yang sama yang di-bind lewat `--host`, setup container/remote, atau build lain — bukan halaman cloud. *Catatan riset: versi persis yang kamu pakai tidak ditentukan, jadi jalur pastinya tidak bisa dipastikan.*
- **Bun-nya terverifikasi di semua lapis yang bisa dicek:** `package.json` paket `@oh-my-pi/omp-stats` mendeklarasikan `"engines": { "bun": ">=1.4.4" }`, skripnya `bun run`, dependensi runtime-nya cuma React, React DOM, dan lucide-react — **tidak ada Express/Hono/framework server Node**, jadi lapisan HTTP-nya menumpang runtime Bun sendiri, dan storage-nya eksplisit `bun:sqlite`. *Hedge dari riset: file sumber servernya sendiri tidak dibuka, jadi pemanggilan literal `Bun.serve(...)` sangat mungkin tapi tidak dikutip sebagai fakta; ekuivalen idiomatiknya untuk implementasi kita memang `Bun.serve({ port, hostname, fetch })`.*
- **Pipeline data:** log sesi JSONL dari `~/.omp/agent/sessions/` disinkronkan inkremental (kursor tersimpan, commit atomik) ke SQLite `~/.omp/stats.db` dengan rollup per jam (`message_rollup` / `tool_rollup` / `session_rollup`); watcher menyinkronkan ulang transkrip yang sedang ditulis; API-nya `GET /api/stats`, `/api/stats/models`, `/api/stats/timeseries`, `/api/status`, `GET /api/events` (SSE), `POST /api/sync`.
- **Halaman dashboard-nya:** Overview, Models, Providers, Costs, Requests, Errors, Traces, Tools, **Frustration**, Projects, Gain.

Sumber: [github.com/can1357/oh-my-pi — packages/stats](https://github.com/can1357/oh-my-pi/tree/main/packages/stats) · [packages/stats/package.json](https://github.com/can1357/oh-my-pi/blob/main/packages/stats/package.json) · [omp.sh/docs/cli](https://omp.sh/docs/cli)

### 2. Usage per model: yang dicatat semua agent; RAM: belum ada yang mencatat

- **Model data per request yang jadi konvensi semua agent** (OMP, Claude Code `/usage`, OpenCode `opencode stats`, Codex `/status` + `/usage`): provider + model versi persis, timestamp, sesi/proyek, token input, output, cache-read, cache-write, reasoning bila dilaporkan, durasi request dan TTFT (turunannya tokens/s), stop reason (turunannya error rate), dan panggilan tool. Biaya = token × rate card publik, **dilabeli estimasi setara API**; model langganan tanpa harga publik ditampilkan `N/A`, bukan \$0.
- **Metrik turunan versi omp-stats:** Tokens/s = `output_tokens / (duration/1000)`; Cache Rate = `cache_read / (input + cache_read) * 100`; Error Rate = `count(stopReason=error) / total_calls * 100`; plus Cache Savings, Avg Latency, TTFT.
- **RAM/CPU proses tidak ada di omp-stats sama sekali** — tidak ada halaman atau metriknya. Konteks % pun di OMP hidup di footer TUI, bukan di dashboard. Jadi statistik RAM di plan ini **pekerjaan baru**, bukan meniru OMP. Referensi UX-nya tool standalone seperti btop / bottom (`btm`) / htop yang polling tiap 1–2 detik.
- **API-nya (Node-compatible, jalan di Bun):** `process.memoryUsage()` — `rss` adalah angka headline “RAM agent ini” dan satu-satunya angka memori yang maknanya kurang lebih sama di semua OS; `process.cpuUsage()` dalam mikrodetik kumulatif, CPU% wajib dari selisih dua sampel; mesin: `os.totalmem()` / `os.freemem()` / `os.cpus()` (diff dua snapshot). Detail heap Bun: `bun:jsc` `heapStats()`.
- **Jebakan Windows:** `os.loadavg()` selalu `[0, 0, 0]` di Windows (sembunyikan field-nya di `win32`); RSS proses induk **tidak** termasuk proses anak (LSP, shell, subagent) — total footprint butuh penjumlahan pohon proses; di luar builtin, pustaka `systeminformation` dukungannya eksplisit “Linux, macOS, partial Windows” dan di Windows men-shell-out ke PowerShell, jadi lambat.

Sumber: [omp-stats README (definisi metrik)](https://github.com/can1357/oh-my-pi/tree/main/packages/stats) · [Node.js os docs (loadavg di Windows)](https://nodejs.org/download/release/v4.2.0/docs/doc/api/os.html) · [npm — systeminformation](https://npm.io/package/systeminformation)

### 3. Frustrasi per model: sudah ada di OMP, tapi tidak ada yang menindaklanjutinya

- **Fakta utamanya:** sejak **v18.4.0**, dashboard omp-stats punya halaman **Frustration**: per *versi model*, seberapa sering pesan user tergolong *annoyed*, *annoyed at the assistant*, dan *angry at it*. Halaman ini menggantikan halaman Behavior lama yang, dalam kata-kata port-nya, mengukur “seberapa sering user memaki modelnya”.
- **Klasifikasi dua tingkat.** (a) Sinyal heuristik lokal regex atas prosa yang sudah dibersihkan (fence kode, kode inline, tag, URL, mention file, baris kutipan dibuang dulu; pencocokan word-boundary, case-insensitive):

| Sinyal     | Yang ditangkap                                                                                                                         |
|------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Yelling    | Kalimat mayoritas CAPS multi-kata                                                                                                      |
| Profanity  | Daftar kata umpatan terkurasasi (termasuk varian tersensor); slur identitas dan kata yang teknis di korpus coding sengaja dikecualikan |
| Anguish    | `!!!`, `noooo`, `ugh`, `argh`, `dude`, `:(`                                                                                            |
| Negation   | Pembuka pesan `no` / `nope` / `wrong`, `makes no sense`                                                                                |
| Repetition | `like i said`, `i already told you`, `still doesnt`                                                                                    |
| Blame      | `you didn't`, `why did you`, `stop X-ing` di awal kalimat                                                                              |

- **Guard anti false-positive:** pesan ≥3 baris prosa dinolkan semua sinyal emosionalnya di OMP upstream (prompt yang diformat rapi dianggap disengaja, bukan emosional). Tiga bucket bersarang: annoyed = sinyal apa pun menyala; at-assistant = negation + repetition + pola blame; angry = at-assistant **dan** (profanity atau yelling).
- **(b) Judge LLM opsional:** role model `judge` mengklasifikasi tiap teks prosa unik (estimasi biaya ditampilkan *sebelum* jalan; verdict di-cache berdasarkan hash prosa di tabel `frustration_verdicts`, jadi run ulang gratis). Dengan verdict: annoyed = P(level 2) + P(level 3) ≥ 0.5; angry = P(level 3) ≥ 0.5 plus targetnya harus assistant; baris dengan verdict \<50% pesan ditandai “mostly regex”.
- **Atribusi:** tiap pesan user diatribusikan ke model yang sedang diajak bicara user (mengikuti pergantian model di tengah sesi) — itu yang membuat tabel per versi model mungkin. Semuanya lokal kecuali panggilan judge-nya sendiri.
- **Sinyal perilaku gratis** dari log sesi yang sudah ada: frekuensi rewind/undo dan revert edit, diff git yang dibuang setelah giliran agent, prompt nyaris identik dikirim ulang, model diganti manual tepat setelah sebuah giliran, sesi ditinggal di tengah tugas.
- **Dukungan akademis:** paper ICSE 2026 (Nam, Salawa & Chandra) menemukan sinyal kepuasan yang bisa dipakai di ~8% interaksi prompt developer, \>13× laju feedback eksplisit, dari log industri 372 developer profesional.
- **Celahnya:** **tidak ditemukan satu pun agent yang memakai frustrasi untuk menyarankan apalagi melakukan pergantian model** — OMP hanya melaporkan. Ini temuan ketiadaan bukti dari pencarian yang dilakukan, bukan bukti pasti; lapis saran/switch-nya wilayah yang belum diklaim di sumber publik.

Sumber: [Release OMP v18.4.0](https://github.com/can1357/oh-my-pi/releases/tag/v18.4.0) · [opencode-mouth — how-it-works (port terdokumentasi dari fitur OMP)](https://raw.githubusercontent.com/pixincreate/opencode-mouth/master/docs/how-it-works.md) · [npm — opencode-mouth](https://npm.io/package/opencode-mouth/v/2.0.0) · [ICSE 2026 NIER — Reading Between the Lines](https://conf.researchr.org/details/icse-2026/icse-2026-nier/3/Reading-Between-the-Lines-Scalable-User-Feedback-via-Implicit-Sentiment-in-Developer)

### 4. Combo fallback: mekanik 9Router, dan versi OMP yang lebih kuat

**9Router — combo = model virtual bernama.** Daftar terurut string `provider/model` yang dibuat di dashboard web (`http://localhost:20128`, Dashboard → Combos), lalu klien cukup mengirim **nama combo sebagai field `model`** ke `http://localhost:20128/v1`. Combo bebas mencampur provider, langganan, API berbayar, dan tier gratis — pencampuran itu memang tujuannya (“Subscription → Cheap → Free”).

    // Combo "premium-coding" (contoh dari docs 9Router)
    [ "cc/claude-opus-4-5-20251101",  // langganan, dicoba dulu
      "glm/glm-4.7",                  // cadangan murah
      "minimax/MiniMax-M2.1" ]        // fallback termurah
    // Request klien: { "model": "premium-coding", ... }

- **Strategi default Fallback:** coba berurutan, maju ke model berikutnya **hanya saat gagal** — di docs: rate limit (429) atau error transien 502/503/504; error seperti 400 dikembalikan ke klien langsung dan tidak menelusuri rantai. Tiap model dicoba **sekali**, tidak ada loop retry di dalam combo. Strategi lain: **Round Robin** (rotasi model awal, ada sticky limit), **Smart Router** (model judge memilih di depan, fail-open ke urutan sekuensial), **Fusion** (semua model paralel + judge mensintesis), plus penataan ulang otomatis berdasar kapabilitas yang dibutuhkan giliran ini. Combo juga bisa punya batas budget harian/bulanan (model berbayar diskip demi yang gratis saat batas kena).
- **Penyimpanan — ada selisih versi yang harus diketahui:** `docs/ARCHITECTURE.md` 9Router (Feb 2026) mendokumentasikan lowdb `~/.9router/db.json`; catatan kode yang lebih baru menyebut migrasi ke SQLite (`~/.9router/db/data.sqlite`, tabel `combos` berisi `name` + array JSON `models`). Perlakukan `db.json` sebagai bentuk terdokumentasi/lama dan SQLite sebagai bentuk terkini.

**OMP — `retry.fallbackChains`, native dan lebih umum**, di `~/.omp/agent/config.yml`. Preseden file-config terbersih selain itu: LiteLLM (`fallbacks: [{"primary": ["fallback-1", …]}]` atas grup `model_name` bernama). Upstream Pi tidak punya rantai native (ekstensi yang menambahkan); OpenCode tidak native (plugin yang menambahkan); Cline/Roo Code tidak punya rantai bernama dan mendelegasikan ke gateway di bawahnya.

    retry:
      enabled: true
      maxRetries: 10            # retry model sama, backoff 500ms → 300000ms
      modelFallback: true
      fallbackOn: any           # any | usage-limit | except-usage-limit
      fallbackRevertPolicy: cooldown-expiry
      fallbackChains:
        default:                # kunci role; role tanpa rantai mewarisi ini
          - anthropic/claude-opus-4-5
          - openai/gpt-5.5
          - google/gemini-3-pro
        smol: []                # [] mematikan fallback untuk role ini
        google/gemini-3-pro:    # kunci model persis
          - google-vertex/gemini-3-pro
        google-antigravity/*:   # kunci provider/*
          - google/*            # entri provider/* menukar provider saja

- **Mekanik yang dicopy ke plan ini:** resolusi berdasar spesifisitas (model persis \> `provider/*` \> role \> `default`); kandidat yang sedang cooldown, tanpa kredensial, atau tidak kompatibel diskip; **rotasi kredensial di dalam satu provider dicoba sebelum fallback model**; `fallbackOn: usage-limit` membatasi penelusuran hanya untuk error kuota/belanja; perubahan config di-reload langsung. Yang tidak dimiliki OMP: pengemasan 9Router (nama virtual yang bisa ditulis di field model, editor dashboard, strategi round-robin/fusion).
- **Bentuk config final untuk agent ini** (sintesis 9Router + OMP + LiteLLM, dieksekusi di Fase 6): combo bernama yang bisa dipakai di mana pun penyeleksi model bisa dipakai, termasuk oleh role; daftar terurut penyeleksi `provider/model` yang sepenuhnya terkualifikasi dan bebas dicampur; `fallbackOn` per combo; cooldown + kebijakan revert; combo satu entri valid sebagai alias.

Sumber: [9Router — combos.md](https://github.com/decolua/9router/blob/master/gitbook/content/en/features/combos.md) · [9Router — ARCHITECTURE.md](https://github.com/decolua/9router/blob/master/docs/ARCHITECTURE.md) · [OMP — docs/settings.md (retry.fallbackChains)](https://github.com/can1357/oh-my-pi/blob/main/docs/settings.md) · [OMP — docs/models.md](https://github.com/can1357/oh-my-pi/blob/main/docs/models.md) · [LiteLLM — fallbacks](https://docs.litellm.ai/docs/proxy/reliability)

Vonis final riset

**Bisa, semuanya.** `/stats` ala OMP bisa ditiru persis dengan stack yang sudah direncanakan (Bun + `bun:sqlite` + JSONL yang sudah ada dari Fase 5) dan ditambah panel RAM proses yang tidak dimiliki siapa pun. Combo fallback bisa diatur user sebagai **model virtual bernama di file config** — lebih enak dari 9Router yang editnya dashboard-only — dengan mekanik pemicu dan cooldown meniru OMP. Frustrasi per model bisa diukur lokal secara gratis (regex + sinyal perilaku), judge LLM-nya opsional dan berbayar-terukur; dan karena **tidak ada agent yang menindaklanjuti sinyal frustrasi menjadi saran ganti model**, lapis saran itulah pembeda nomor empat agent ini. Ketiganya masuk plan sebagai: Fase 6 yang diperluas (combo), Fase 12 (dashboard stats + RAM), dan Fase 13 (frustrasi + saran switch).

## A3 Riset penutup 2: Discord Rich Presence yang lengkap

Riset 7–8 Nov 2026 atas dokumentasi resmi Discord (RPC + Social SDK), tool presence yang sudah ada (VSCord, presence.nvim, claude-presence, claude-rpc, opencode-rich-presence), plugin Orca jondmarien, dan proyekmu sendiri `orca-discord-rpc`. Ini yang menambah Fase 14 ke plan.

### 1. Cara kerja: IPC lokal, tanpa token, tanpa OAuth

- **Discord RPC itu IPC lokal, bukan API jaringan dan bukan bot.** Prosesmu bicara ke Discord *desktop* di mesin yang sama: Windows lewat named pipe `\\?\pipe\discord-ipc-{0..9}`, Linux/macOS lewat unix socket (`$XDG_RUNTIME_DIR` → `$TMPDIR` → `$TMP` → `$TEMP` → `/tmp`, urutan persis begitu). Indeks 0–9 dicoba berurutan; tidak ada yang terbuka berarti Discord tidak jalan, dan itu keadaan normal. Discord di browser tidak bisa menerima RPC. Transport WebSocket lokal (`ws://127.0.0.1:6463..6472`) sudah deprecated, jangan dibangun di atasnya.
- **Protokolnya kecil:** header 8 byte (opcode + panjang payload, little-endian) lalu JSON UTF-8. Opcode 0 = handshake `{"v": 1, "client_id": "…"}`, opcode 1 = frame perintah termasuk `SET_ACTIVITY`, opcode 2 = close, 3/4 = ping/pong. Presence dihapus dengan `SET_ACTIVITY` ber-`activity` null.
- **Presence-only tidak butuh autentikasi sama sekali.** Panduan Social SDK resmi menyatakan Rich Presence bisa disetel tanpa autentikasi; syaratnya hanya Discord desktop jalan dan Application ID yang valid. Alur OAuth `AUTHORIZE`/`AUTHENTICATE` itu untuk set perintah RPC penuh (voice, guild, notifikasi), bukan untuk presence. **Jangan pernah meminta atau menyimpan client secret atau token user/bot** — tool yang minta token user itu wilayah self-bot yang dilarang Discord; desain IPC lokal tidak memegang kredensial apa pun.
- **Yang didaftarkan di Developer Portal:** satu Application (namanya jadi baris `Playing <nama>` di kartu, jadi namai sesuai agent), Application ID-nya (= Client ID, publik, aman disematkan di klien), dan art assets di Rich Presence → Art Assets: disarankan 1024×1024, maks 300 aset per app, key otomatis di-lowercase oleh portal. Alternatif upload: URL gambar eksternal (`mp:`/https). Tidak perlu bot user, tidak perlu redirect URI.
- **Syarat sisi user:** Settings → Activity Privacy di Discord harus aktif, kalau tidak kartu diam-diam tidak tampil ke orang lain. Ini langkah troubleshooting nomor satu, bukan bug kita.

Sumber: [Discord RPC docs](https://docs.discord.com/developers/topics/rpc) · [Social SDK — Setting Rich Presence](https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence)

### 2. Batas keras kartunya: dua baris teks, itu saja

- **Langit-langitnya kecil dan tetap:** dua baris teks (`details` dan `state`, masing-masing **2–128 karakter**, string 1 karakter tidak valid), dua slot gambar dengan tooltip (`large_image`/`large_text` dan `small_image`/`small_text`, tooltip maks 128 karakter), satu timer, satu field party `(current of max)`, dan **maks 2 tombol URL**. Tidak ada API field kustom: semua yang mau ditampilkan agent (model, tool, token, biaya, subagent) harus *dikodekan* ke dua baris itu, tooltip, atau party.
- **Timer:** `timestamps.start` (detik unix) menghitung naik (`42:17 elapsed`) dan harus nilai yang sama di setiap update, kalau berubah timer ke-reset. `timestamps.end` mengganti tampilan jadi hitung mundur dan menimpa semantik elapsed — untuk countdown budget kedengarannya menarik tapi tidak bisa dilabeli sebagai budget dan mengorbankan timer sesi, jadi plan ini pakai start saja; sisa budget ditulis sebagai teks di `state`.
- **Tombol tidak terlihat oleh pemiliknya.** Dokumentasi resmi: tombol presence hanya tampil ke user *lain*; pemilik tidak pernah melihat tombolnya sendiri di profilnya. “Tombolku hilang” adalah perilaku yang diharapkan — uji pakai akun kedua. Tombol juga praktisnya hanya jalan untuk URL https publik.
- **Party untuk worker: bisa, tapi opt-in.** `party.size = [running, max]` dirender sebagai `(3 of 5)` menempel di baris state — satu-satunya hitungan terstruktur yang Discord punya. Risikonya semantik: party menjanjikan grup orang yang bisa di-join. Proyekmu sendiri menghindari party dan memakai sufiks `+1` di baris details untuk pane agent tambahan, nol ambiguitas. Plan ini meniru itu sebagai default; party mode jadi opt-in dengan `privacy: PRIVATE`, id party acak per sesi, dan **tanpa join secret selamanya** (sesi CLI tidak bisa di-join; secret palsu membuat tombol Join rusak di profil user).
- **Rate limit: 1 update per 15 detik** menurut dokumentasi Rich Presence resmi, dan SDK resmi mengantrekan update di dalam jendela itu. Klien IPC mentah *tidak* dapat antrean gratis, jadi coalescer-nya wajib kita bangun sendiri: dedupe payload sama, interval minimum 15 detik, flush trailing-edge (yang terbaru menang). Angka komunitas yang lebih cepat (5 per 20 detik dari satu proyek OpenCode; 5 per 60 detik itu limit *bot gateway*, permukaan yang beda) tidak mengalahkan angka resmi ini.

Sumber: [Social SDK — Activity class reference](https://discord.com/developers/docs/social-sdk/classdiscordpp_1_1Activity.html) · [Rich Presence How-To (1 update / 15 detik)](https://github.com/anothergenz/discord-api-docs/blob/HEAD/docs/rich_presence/How_To.md)

### 3. Library: hand-roll menang, dan proyekmu sendiri buktinya

- **Rekomendasi: hand-roll klien IPC-nya** (kurang lebih 150–250 baris: penemuan path 0–9, framing, handshake, `SET_ACTIVITY`, reconnect), atau pakai `@xhayper/discord-rpc` hanya selama prototyping. `orca-discord-rpc` milikmu sudah membuktikan jalur hand-roll ini di produksi: Node built-ins saja, **nol dependensi runtime npm**, bundle ±63 KB dibanding ±1,4 MB bundle SDK sebelumnya. Satu ekstensi VS Code juga mengganti `@xhayper/discord-rpc` dengan klien hand-roll dan melepas ±12 paket transitif (`undici`, `ws`) yang tidak pernah dipakai.
- **`@xhayper/discord-rpc` adalah satu-satunya opsi TypeScript yang kredibel** bila library dipakai (fork `discordjs/RPC` dengan type safety; Socket.dev mencatat v1.3.0 ±6 bulan lalu, dan VSCord memasang `^1.3.0`). Keanehannya terdokumentasi: harus panggil `login()`, bukan `connect()` (yang tidak pernah memancarkan `ready`), dan instance yang dibuang harus dipensiunkan penuh karena `login()` ulang di instance yang sama membocorkan listener. Paket asli `discord-rpc` basi (rilis terakhir ±2 tahun lalu); Game SDK sudah legacy dan diarahkan Discord ke Social SDK, dan keduanya SDK native untuk game — bukan untuk CLI TypeScript/Bun.
- **Reconnect selalu kode aplikasi, bukan library:** pola yang terbukti adalah backoff eksponensial 1–30 detik atau retry datar 30 detik, pindai ulang indeks pipe 0–9 tiap percobaan (Discord bisa kembali di indeks berbeda), dan kirim ulang state terakhir begitu `READY`. Mode gagal yang harus ditangani: Discord belum mulai saat agent jalan, Discord restart di tengah sesi, Discord ditutup (presence hilang bersama pipe-nya), dan socket setengah mati yang menerima tulisan tapi tidak pernah membalas.
- **Satu ketidakpastian yang jujur: binary Bun di Windows.** Bun menargetkan kompatibilitas `node:net` dan named pipe Windows memang masuk cakupannya, tapi ada bug historis (issue \#13042, connect named pipe gagal `ENOENT` di Bun 1.1.20 padahal skrip yang sama jalan di Node) dan area ini baru dirombak Bun belakangan. *Tidak ditemukan sumber yang memverifikasi klien Discord IPC apa pun di dalam binary `bun build --compile` di Windows* — jadi plan ini mewajibkan spike setengah hari dulu (Fase 14, tugas 1) sebelum bentuk final modul diputuskan. Jalan cadangannya berurutan: API native `Bun.connect({unix})`, lalu sidecar skrip Node/Bun kecil yang di-spawn binary utama.
- **Bentuk proses: in-process untuk v1.** Daemon/tray itu lahir dari keterbatasan host: Claude Code tidak bisa meng-host modul ini (hook-nya proses berumur pendek, jadi claude-presence terpaksa daemon + file bridge), dan exe Orca mendahului plugin host-nya. Agent ini milik kita sendiri, jadi modul in-process adalah default yang benar; ekstraksi daemon hanya dipertimbangkan lagi bila agregasi multi-proses jadi fitur utama. Satu peringatan dari catatan migrasimu sendiri: dua provider presence jalan bersamaan membuat kartu flip-flop antar state — tegakkan satu instance.

Sumber: [orca-discord-rpc (proyekmu)](https://github.com/meryzennn/orca-discord-rpc) · [@xhayper/discord-rpc](https://github.com/xhayper/discord-rpc) · [Socket.dev — v1.3.0](https://socket.dev/npm/package/@xhayper/discord-rpc/versions/1.3.0) · [Bun — node:net reference](https://bun.sh/reference/node/net) · [Discord — migrasi Game SDK ke Social SDK](https://support-dev.discord.com/hc/en-us/articles/30125671534359-Migrating-from-the-Legacy-Game-SDK-to-the-Discord-Social-SDK)

### 4. Yang ditampilkan agent (bukan editor), dan contoh kartunya

**Aturan petanya: `details` = yang sedang dilakukan agent sekarang; `state` = konteks sesi yang awet; tooltip = luapan; party = worker (opt-in saja).** Baseline editor (file, ikon bahasa, workspace, jumlah problem) sebagian besar tidak relevan untuk CLI agent; yang menggantikannya adalah model, tool, dan status — persis yang dipilih tool agent yang sudah ada: claude-presence menampilkan nama model termasuk tier konteks (`Opus 5 (1M context)`), token sesi, estimasi biaya (ditandai `~` bila hasil estimasi), dan aktivitas dari event tool (`Write/Edit → Editing app.tsx`, `Bash → Running terminal command` — nama tool-nya, *bukan* perintahnya), plus status Waiting setelah turn selesai atau 2 menit senyap.

| Datum agent            | Slot Discord                                                                                                                          |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Status + aksi sekarang | `details` + ikon `small_image`: `Working — editing src/auth.ts`, `Planning — …`, `Orchestrating — 3 workers running`                  |
| Menunggu persetujuan   | `details` + ikon waiting khusus — state bernilai tertinggi, karena ini yang dilihat user dari HP saat agent-nya berhenti menunggu dia |
| Model / nama combo     | Tooltip `large_text`, atau ekor `state` bila harus terlihat di daftar member (tooltip tidak tampil di daftar ringkas)                 |
| Token sesi             | Ekor `state`, format ringkas: `· 128k tok`                                                                                            |
| Biaya / sisa budget    | Ekor `state` (`· ~$0.70`, `~` = estimasi) — tapi mati secara default, lihat privasi                                                   |
| Proyek · branch        | Kepala dan tengah `state`, keduanya ter-gate privasi                                                                                  |
| Waktu sesi             | `timestamps.start` tetap per sesi agent; tidak ada timer kedua untuk per-task                                                         |
| Link repo              | `buttons[0]` “View Repository”, hanya remote https publik                                                                             |

**Arbitrase multi-sesi dan mode coordinator.** Satu proses: agregat token/biaya = jumlah semua worker, status = state worker berprioritas tertinggi (`waiting-for-approval > error > working > planning > idle`). Banyak proses agent independen di satu mesin: hanya satu yang boleh memegang kartu atau kartunya flip-flop — v1 cukup last-active-wins yang teredam alami oleh coalescer 15 detik; lockfile leader, lalu daemon agregator ala opencode-rich-presence, adalah tangga berikutnya.

    Playing <NamaAgent>                    ← nama app di portal
    Working — editing discord/presence.ts  ← details
    📁 my-repo · sonnet-5 · 128k tok · ~$0.70  ← state (biaya ON)
    [besar: logo agent] [kecil: ikon working,
       tooltip "claude-sonnet-5 · combo: fast"]
    42:17 elapsed                          ← timestamps.start
    [ View Repository ]                    ← buttons[0]

    Mode coordinator:
    Orchestrating — 3 workers · 1 waiting approval
    📁 my-repo · opus-5 (coordinator) · 412k tok
    (3 of 5)  ← hanya bila party mode opt-in aktif

Dengan semua default privasi yang direkomendasikan (proyek nyala, branch mati, biaya mati), kartunya menyusut jadi dua baris bersih: `Working — running tests` dan `📁 my-repo · sonnet-5 · 128k tok`.

### 5. Privasi: presence itu siaran publik, jadi kontrolnya dirancang dari awal

Kartu ini tampil ke **seluruh daftar teman dan semua server bersama user**, terus-menerus selama sesi. Semua tool yang matang konvergen ke kontrol yang sama — mode privasi/incognito global, matikan per workspace/proyek, dan toggle per field — karena kebocoran nama proyek/file adalah keluhan nomor satu di semua ekosistem (VSCord punya privacy mode + daftar ignore, JetBrains akhirnya membuat nama proyek opt-in “untuk menghindari kebocoran informasi”, claude-presence tidak pernah menampilkan proyek atau branch sama sekali, pluginmu punya Incognito di status bar). Default yang disintesis riset:

| Datum                                                      | Default                                          | Alasan                                                                                                                                                                  |
|------------------------------------------------------------|--------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Status + kata kerja tool generik                           | Nyala                                            | Inti fiturnya; tidak memuat konten user                                                                                                                                 |
| Model / nama combo, token sesi                             | Nyala                                            | Sensitivitas rendah; semua tool agent menampilkannya                                                                                                                    |
| Estimasi biaya / budget                                    | **Mati**                                         | Informasi finansial; opt-in eksplisit (`showCost`)                                                                                                                      |
| Nama proyek / repo                                         | Nyala + Incognito + opt-out per proyek           | Kontrol yang paling diminta di semua ekosistem; satu tombol Incognito menukarnya jadi `Private Project` dan menyembunyikan branch, nama file, dan tombol repo sekaligus |
| Nama branch                                                | **Mati**                                         | Branch membocorkan ID tiket, nama klien, codename fitur                                                                                                                 |
| Nama file                                                  | Basename saja, bisa dimatikan, mati di Incognito | Path penuh membocorkan struktur direktori; pola sensitif (`.env`, `*secret*`) disembunyikan otomatis                                                                    |
| Argumen tool (perintah shell, query, URL, potongan prompt) | **Tidak pernah**                                 | Perintah rutin memuat token dan hostname internal; tampilkan kata kerjanya saja                                                                                         |
| Tombol repo                                                | Hanya remote https publik; sembunyi di Incognito | Tombol adalah tautan publik dari profil user ke repo                                                                                                                    |

Tidak ditemukan dokumen kebijakan konten RPC khusus dari Discord; yang berlaku adalah aturan autentikasi/token di dokumentasi developer plus praktik para peer di atas. Mekanismenya sendiri adalah fitur resmi yang terdokumentasi, jadi pekerjaan kepatuhannya adalah default privasi ini, bukan izin khusus.

Sumber: [claude-presence](https://github.com/backyarddd/claude-presence/blob/HEAD/README.md) · [claude-rpc](https://claude-rpc.com/) · [opencode-rich-presence](https://github.com/engix3/opencode-rich-presence/blob/HEAD/AGENTS.md) · [Orca catalog — Rich Presence for Discord (jondmarien, “every field is opt-in”)](https://www.onorca.dev/plugins/jondmarien/orca-discord-presence) · [VSCord — features](https://deepwiki.com/narcisbugeag/vscord/4-features) · [JetBrains Discord Integration V2](https://plugins.jetbrains.com/plugin/23420-discord-integration-v2) · [presence.nvim](https://github.com/andweeb/presence.nvim)

Vonis final riset

**Bisa, dan bentuknya sudah jelas.** Discord RPC untuk agent ini adalah **modul in-process hand-rolled** (nol dependensi runtime, meniru yang sudah terbukti di `orca-discord-rpc` milikmu) yang diberi makan event loop, dengan coalescer 15 detik, reconnect backoff, dan fail-silent total. Isi kartunya mengganti baseline editor dengan data khas agent: status dan kata kerja tool di `details`, proyek · model · token di `state`, ikon status di gambar kecil, timer sesi dari `timestamps.start`, dan tombol repo bila remote-nya publik. Privasi adalah bagian dari desain, bukan tambahan: biaya dan branch mati secara default, argumen tool tidak pernah tampil, ada Incognito satu tombol dan opt-out per proyek. Dua hal yang masih terbuka dan ditulis apa adanya di plan: perilaku named pipe di binary `bun build --compile` Windows belum terverifikasi di sumber mana pun (wajib spike dulu), dan apakah Discord menegakkan limit 15 detik di sisi klien untuk IPC mentah (dibuang atau diantrekan) tidak terdokumentasi — coalescer kita dirancang seolah update di dalam jendela itu hilang. Masuk plan sebagai **Fase 14**.

## A4 Riset penutup 3: appearance, status line, dan profil ringan Oh My Pi / Pi

Riset 7–8 Nov 2026 atas dokumentasi resmi omp.sh (themes, settings, using), dokumen tema upstream Pi, dokumentasi status line Claude Code, dan pengukuran pihak ketiga soal berat Oh My Pi. Kepercayaan: tinggi untuk tema dan konfigurasi status line (dokumen resmi), sedang untuk angka ringan — tidak ada benchmark resmi, semua angka di bawah adalah pengukuran atau estimasi pihak ketiga dan dilabeli begitu. Ini yang menambah Fase 15 dan menutup plan di 16 fase (0–15).

### 1. Tema: format Pi/OMP — satu file JSON, `vars` + `colors`

- **OMP punya ±100 nama tema**: 98 palet di `defaults/` (mis. `dark-catppuccin`, `dark-tokyo-night`, `dark-gruvbox`, `light-paper`) plus dasar `dark`/`light`, per audit v17.2.12 (Sep 2026); jumlahnya terus bertambah, dan dokumen resminya sendiri bilang daftar di `/settings` adalah katalog otoritatif untuk versi yang terpasang — jangan menyalin nama dari rilis lain.
- **Dua slot, bukan satu tema “system”:** di `~/.omp/agent/config.yml` ada `theme.dark` (default `titanium`) dan `theme.light` (default `light`); OMP memilih slot yang cocok dengan latar terminal. Ganti tema lewat `/settings` → Appearance → Dark/Light Theme dengan **pratinjau langsung** (Enter mempertahankan, Esc memulihkan); tidak ada perintah `/theme` di OMP saat ini (itu UX Pi lama).
- **Deteksi terang/gelap:** latar yang dilaporkan terminal lewat **OSC 11**, fallback `COLORFGBG`, dan **dievaluasi ulang selagi TUI jalan** — mengganti penampilan terminal/OS menukar slot secara langsung.
- **Tema kustom:** satu file JSON per tema di `~/.omp/agent/themes/<name>.json`, berisi `name`, palet `vars`, peta `colors` token semantik, dan blok `export` opsional untuk ekspor HTML. Nilai warna: `#RRGGBB` \| indeks 256 warna \| nama var (boleh bersarang) \| `""` (default terminal). File kustom yang aktif **di-hot-reload** saat disimpan (debounce singkat; simpan yang rusak mempertahankan versi baik terakhir; file tidak valid saat startup jatuh ke `dark` bawaan). Dua keanehan yang dicatat apa adanya: **tema bawaan menang bila namanya bertabrakan dengan file kustom**, dan **file tema lokal proyek tidak dipindai** OMP sama sekali (direktori `.omp/themes/` diabaikan) — divergensi yang disengaja dari Pi.
- **OMP mewajibkan 66 token** di `colors`: 51 token Pi + **13 token khusus status line** (`statusLineSep`, `statusLineModel`, `statusLinePath`, `statusLineGitClean/Dirty`, `statusLineContext`, `statusLineSpend`, `statusLineStaged/Dirty/Untracked`, `statusLineOutput`, `statusLineCost`, `statusLineSubagents`) + `statusLineBg` + `pythonMode`. Skemanya `additionalProperties: false`: **satu kunci asing saja menenggelamkan seluruh file kustom ke fallback** — tepi tajam yang sengaja tidak ditiru plan ini.
- **Upstream Pi lebih ramping:** tepat dua bawaan (`dark` default, `light`), **51 token wajib** (11 core, 11 latar & konten, 10 markdown, 3 diff, 9 syntax, 6 border thinking, 1 `bashMode`), pasangan terang/gelap ditulis di dalam satu string tema (`pi --use-theme light/dark`), dan penemuannya lebih luas: `~/.pi/agent/themes/*.json`, **tema proyek `.pi/themes/*.json`** (hanya proyek tepercaya), dan tema yang dibagikan sebagai **paket berisi JSON saja** lewat entri `pi.themes` di `package.json` — tema komunitas (Catppuccin, Dracula, Nord, varian Gruvbox) memang cuma file data, tanpa kode. OpenCode menyelesaikan terang/gelap dengan cara ketiga: pasangan `{dark, light}` per warna di dalam satu file tema.

Sumber: [omp.sh/docs/themes](https://omp.sh/docs/themes) · [omp.sh/docs/settings](https://omp.sh/docs/settings) · [Pi — docs/themes.md (51 token)](https://github.com/weidu12123/liyuan/blob/HEAD/packages/coding-agent/docs/themes.md) · [Audit registri tema OMP (98 + dark/light)](https://github.com/krikchaip/dotfiles/blob/HEAD/home/dot_pi/agent/packages/oh-my-pi-themes/docs/research/2026-08-10.md)

### 2. Status line: OMP pakai segmen bawaan, Claude Code pakai perintah eksternal

- **Isi default OMP** (dokumen resmi “Using omp”): model aktif + level thinking, mode kerja, path, keadaan Git, pemakaian konteks, biaya, dan nama sesi; terminal sempit menghilangkan atau memendekkan segmen. State Plan, Goal, Vibe, Loop, Fast, kolaborasi, PR, dan jendela rate-limit provider (segmen `usage`) muncul di sini saat relevan. Baris bawaan yang ter-render contohnya: `3.3s ┃ ~/proj ┃ main *1 +1 ┃ 54%/1M ┃ Opus 4.8 ┃ med ┃ 25.9 tok/s`.
- **Bisa dikonfigurasi penuh lewat segmen:** preset `default | minimal | compact | full | nerd | ascii | custom`; dengan `preset: custom` user mengisi `statusLine.leftSegments` / `rightSegments` dan menyetel `statusLine.segmentOptions` di `~/.omp/agent/config.yml`; opsi lain: `statusLine.separator` (`powerline | powerline-thin | slash | pipe | block | none | ascii`), `transparent`, `sessionAccent`, `showHookStatus`, dan pengukur konteks terpisah `statusLine.contextLine` (mode `percentage | annotated | embedded`, sejak v17.4.0). ID segmen persis per preset tidak dienumerasi di dokumen publik; `omp config list` adalah otoritasnya.
- **Tidak ada hook perintah eksternal bawaan di OMP maupun Pi.** Yang ada adalah API ekstensi in-process warisan Pi: `ctx.ui.setStatus(key, text)` (slot bernama di footer), `ctx.ui.setWidget(...)`, dan `ctx.ui.setFooter(factory)` (mengganti footer seluruhnya). Buktinya celah ini terasa: ekstensi pihak ketiga `omp-custom-statusline` **menciptakan ulang kontrak Claude Code** untuk OMP — config sendiri `~/.omp/agent/statusline.config.json` (`command`, `timeoutMs` default 2000, `intervalMs` default 5000) atau env `OMP_STATUSLINE_CMD`. Footer Pi sendiri satu baris tetap (cwd + branch, sesi, token ↑/↓, cache `R`/`CH`, biaya, konteks %; kanan: model + thinking; warna border editor mengkodekan level thinking) dan hanya bisa diubah lewat ekstensi. OpenCode tidak punya keduanya: tidak ada status line perintah eksternal dan tidak ada config daftar segmen; ekstensibilitasnya slot plugin TUI.
- **Kontrak Claude Code adalah desain referensinya** (dokumen resmi): di `settings.json`, `"statusLine": {"type": "command", "command": "~/.claude/statusline.sh", "padding": 0, "refreshInterval": 10, "hideVimModeIndicator": false}`. Perintah dijalankan lewat shell; **JSON di stdin → apa pun yang dicetak ke stdout ditampilkan** (multi-baris = multi baris; ANSI dan hyperlink OSC 8 dihormati), tanpa biaya token model. Perintah `/statusline` bisa membangkitkan skripnya untuk user.
- **Payload stdin Claude Code** mencakup: `model.id`/`display_name`, `effort.level`, `thinking.enabled`, `cwd` + `workspace.*` (termasuk `repo.{host,owner,name}`), `cost.total_cost_usd`/`total_duration_ms`/`total_lines_added/removed`, `context_window.*` (`context_window_size`, `used_percentage`, `remaining_percentage`, `current_usage` per komponen), `rate_limits.five_hour`/`seven_day`/`spend_limit`, `session_id`/`session_name`/`transcript_path`, `pr.*`, `worktree.*`, `vim.mode`. **Gap yang diketahui: `git.branch` TIDAK ada di payload** — skrip terpaksa menjalankan `git` sendiri; plan ini memperbaikinya (Fase 15).
- **Semantik refresh-nya teruji tempur:** jalan saat sesi mulai/resume, pesan assistant baru, `/compact` selesai, mode izin/vim berubah, setting perintah berubah, `refreshInterval` lewat (min 1 detik), dan momen reset rate-limit/cache tiba; update di-**debounce 300 ms** dan trigger baru **membatalkan skrip yang sedang jalan**. Ukuran terminal tidak terdeteksi dari dalam skrip (stdout ditangkap), jadi Claude Code menyetel env `COLUMNS`/`LINES`; dokumennya juga memperingatkan agar kerja mahal seperti `git status` di-cache ±5 detik.

Sumber: [omp.sh/docs/using](https://omp.sh/docs/using) · [OMP docs/settings.md (kunci statusLine.\*)](https://github.com/svperfecta/oh-my-pi/blob/HEAD/docs/settings.md) · [Claude Code — status line (resmi)](https://code.claude.com/docs/en/statusline) · [omp-custom-statusline](https://github.com/yorailevi/omp-custom-statusline/blob/HEAD/README.md) · [Pi — docs/extensions.md (setStatus/setFooter)](https://github.com/lie14f/pi-mono/blob/HEAD/packages/coding-agent/docs/extensions.md)

### 3. Seberapa ringan sebenarnya: Pi ramping by design, OMP tidak

- **Tidak ada benchmark startup/RAM resmi dari OMP maupun Pi.** Semua angka di kartu ini pengukuran atau estimasi pihak ketiga — jangan dikutip sebagai angka vendor. Yang bisa diverifikasi keras: kebutuhan runtime (Pi: Node ≥22.19; OMP: Bun ≥1.3.14 untuk jalur Bun/npm, atau binary prebuilt tanpa runtime) dan ukuran binary.
- **OMP itu maksimalis:** fork Pi dengan ±1,36 juta baris TypeScript + ±170 ribu baris Rust (hitungan satu review; sumber lain melaporkan rentang 55–170 ribu untuk Rust-nya saja), dan **binary prebuilt tunggalnya terukur ±183 MB** (v18.0.7, linux-x64). Installer-nya sendiri rapi: tepat satu file ke `~/.local/bin/omp`, terverifikasi SHA-256, tanpa mengutak-atik dotfile.
- **Estimasi baseline memorinya bukan nol:** analisis arsitektur pihak ketiga mengestimasi **40–90 MB RSS hanya untuk runtime Bun + heap JS** sebelum sesi tumbuh — dan sesi OMP disimpan utuh di memori sebagai objek JS, jadi RSS tumbuh bersama sesi. Di mesin analis yang sama, `stats.db`-nya 77 MB dan folder sesinya 1,4 GB di disk.
- **Startup-nya tidak instan:** satu pengukuran user berpengalaman mencatat `omp -p` membayar **±8 detik overhead startup** sebelum request berangkat (anekdot satu mesin untuk mode headless yang memuat provider, MCP, ekstensi, dan penemuan LSP; TUI interaktif bisa berbeda). Bug nyata lain: satu server MCP yang tidak responsif pernah menahan UI-ready OMP selama **30,282 detik** (timeout MCP penuh); perbaikannya me-race koneksi melawan jendela **250 ms** dan menunda server yang belum ter-cache. Pelajarannya: pemuatan periferal yang malas adalah *fitur startup*, bukan optimasi.
- **Pi upstream memang ramping by design:** harness TypeScript minimal, **4 tool inti**, **system prompt \<1.000 token**. Kesederhanaan itu sendiri strategi performanya — lebih sedikit kode dimuat, lebih sedikit konteks dirakit, lebih sedikit yang di-render per putaran.
- **Yang membuat keduanya cepat di jalur panas:** tanpa Electron (aplikasi Electron membawa Chromium sendiri: installer tipikal 80–150 MB dan 150–300 MB RAM idle sebelum kode user jalan); **rendering diferensial** pi-tui (komponen `render(width): string[]`, hanya rentang baris yang berubah dicat ulang, dibungkus **CSI 2026 synchronized output**); OMP melangkah lebih jauh dengan frame-plan yang **memensiunkan riwayat yang sudah committed ke scrollback terminal dan membebaskan buffer-nya**; inti Rust OMP mengerjakan grep/glob/diff/highlighting/hitung token/PTY dan bash + coreutils in-process; dan pemuatan malas di mana-mana (LSP on-demand secara default, `fetch.preconnect()` menghangatkan DNS/TCP/TLS selagi prompt dirakit).
- **Lantai runtime Bun memang rendah** (benchmark independen, Bun 1.4.3 vs Node 24/26, median hyperfine): skrip kosong **3,3 ms vs 28,5 ms**; menjalankan file `.ts` **3,8 ms vs 62,6 ms**; RSS idle server `node:http` **23 MB vs 58 MB**; aplikasi Hono di bawah beban **36 MB vs 105 MB**. Tapi lantai runtime bukan startup agent: yang mendominasi adalah graf modul sendiri, penemuan config, dan handshake periferal — makanya budget di Fase 15 meninggalkan headroom besar di atas lantai ini, bukan menyalinnya.

Sumber: [Pengukuran binary OMP 183 MB (v18.0.7)](https://trove.xin/en/detailed/oh-my-pi) · [Analisis arsitektur & berat OMP/Pi](https://github.com/freepeak/xdev/blob/HEAD/docs/research/2026-09-09-omp-pi-architecture-go-rebuild.md) · [Anekdot startup omp -p ±8 dtk](https://github.com/ismaelga/omp-config/blob/HEAD/agent/skills/reviewing-model-pins/traps.md) · [Fix stall MCP 30 dtk → race 250 ms](https://github.com/can1357/oh-my-pi/pull/2140) · [Benchmark Bun vs Node](https://dev.to/fabwaseem/bun-vs-nodejs-in-2026-bun-14-vs-node-24-and-26-benchmarked-4pab)

### 4. Panduan desain yang diadopsi plan ini: potong tokennya, pakai dua lapis, tulis budgetnya

**Tema: adopsi format Pi, jangan adopsi 66 token OMP di hari pertama.** Skema v1 ±38 token: core Pi (11) dipertahankan; markdown dipangkas dari 10 ke 6 (sisanya default ke `muted`/`text`/`border` di kode); syntax 9 dipertahankan utuh (highlighting terlihat rusak dengan lebih sedikit); status line cukup **5 token terkonsolidasi** (`statusLineBg`, `statusLineModel`, `statusLinePath`, `statusLineGitClean`, `statusLineGitDirty`) dan memakai ulang `accent/muted/dim/success/warning/error` untuk konteks/biaya/subagent, bukan 13 token terpisah; mode cukup 2 (`bashMode` + satu `thinkingAccent`) — trik Pi/OMP mengkodekan level thinking di border editor dipertahankan, tapi tidak dengan 7 warna per level.

- **Bawaan yang dikirim: 5, bukan 100** — `dark` (palet rumah), `light`, pasangan Catppuccin (Mocha + Latte), Tokyo Night, dan Gruvbox atau Nord; plus tema `system` (kebanyakan warna `""`) yang gratis dan paling tangguh di terminal aneh. 98 tema OMP adalah konsekuensi fork matang berkontributor; lima yang bagus + file user mengalahkan 98 yang medioker untuk v1 solo.
- **Perilaku file yang diperbaiki dari OMP:** token yang hilang **diisi dari tema dasar** dan kunci tak dikenal hanya diperingatkan — tidak pernah menenggelamkan file (anti-pola `additionalProperties: false` OMP). Tema proyek **didukung** (proyek tepercaya saja, meniru Pi; OMP yang tidak memindai proyek adalah yang menyimpang). Preset simbol `unicode | nerd | ascii` dicuri dari OMP sebagai setting global, bukan per tema, di v1.

**Status line: dua lapis, keduanya v1.** Lapis 1 segmen bawaan dengan layout default: kiri `model+thinking · mode · cwd · git (branch +staged ~unstaged ?untracked)`, kanan `context ▓▓░░ 54%/200k · ↑12k ↓3.4k · $0.08 · budget $4.92 left · session · ● status`. Segmen `budget` (sisa budget dari cap `budget.sessionUsd`/`dailyUsd` Fase 6, merah di bawah 10%) adalah segmen khas agent ini: tidak ada agent yang disurvei yang mengirimkannya sebagai segmen kelas satu — Claude Code pun hanya mengekspos spend limit di balik gateway, Pi/OMP menampilkan belanja, bukan sisa. Lapis 2 hook perintah eksternal menggantikan baris lapis 1 (model mental lebih sederhana daripada baris ekstra ala Claude Code), menyalin nama field Claude Code agar skrip dan pengetahuan yang ada bisa pindah, dan memperbaiki dua gap-nya: **`git.branch` + hitungan staged/unstaged/untracked disertakan** dan **blok `budget` disertakan**, jadi skrip tidak perlu shell-out ke git.

| Budget performa v1                  | Target                                                 | Cara mengukur di Bun                                                                                                                                                     |
|-------------------------------------|--------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Cold start ke prompt interaktif     | **\<300 ms** p50 (stretch \<150 ms)                    | `hyperfine` untuk lantai boot + run TUI ter-skrip di PTY; flag `--startup-trace` mencatat mark `performance.now()` (config dimuat / tema dimuat / render pertama / siap) |
| Overhead headless one-shot          | **\<500 ms** (di luar TTFT provider)                   | Waktu sampai byte pertama terkirim ke provider di startup trace                                                                                                          |
| Idle RSS (TUI terbuka, sesi kosong) | **\<100 MB** (stretch \<70 MB)                         | `/usr/bin/time -v` atau `process.memoryUsage().rss`; lantai Bun sendiri ±18–23 MB, sisanya graf modul + state sesi kita                                                  |
| Pertumbuhan RSS per 1.000 pesan     | **\<20 MB** dan terbatas                               | Replay sesi JSONL besar sambil sampling RSS; ditegakkan dengan state sesi berjendela (hanya entri pasca-batas compaction yang panas) dan streaming file \>8 MiB          |
| Latensi ketikan → cat               | **\<16 ms** p95 (satu frame)                           | Rendering diferensial + frame CSI 2026; tes PTY memastikan echo karakter ada di frame berikutnya; redraw penuh dilarang kecuali resize/render pertama                    |
| Perintah eksternal status line      | ≤200 ms tipikal, dibunuh di `timeoutMs` (default 2000) | Desain debounce + cancel + timeout; git di-cache TTL 1–5 detik; skrip lambat dicatat sekali per sesi                                                                     |
| Render streaming                    | ≤30 paint/detik                                        | Delta token dikoales per tick seperti pi-tui; tidak pernah render per token                                                                                              |
| Ukuran binary ter-compile           | **\<60 MB** (stretch \<40 MB)                          | `du -h` artefak rilis di CI; 183 MB OMP adalah harga LSP+debugger+browser+98 tema+7 crate Rust — kalau kita mendekatinya, ada baterai yang harus dinamai                 |

Aturan penjaga budget: semua antrean terbatas, semua sink output tool berukuran tetap (head+tail, sisanya tumpah ke file), blok transkrip yang committed dipensiunkan dan string-nya dibebaskan (terminal adalah arsipnya), dan tes asap CI gagal bila idle RSS atau waktu `--version` regresi \>20%. Ukur di mesin paling lambat yang didukung, bukan mesin dev.

Sumber panduan: bagian 5 laporan riset ini (rekomendasi berbasis temuan di atas) · [pi-tui — rendering diferensial](https://deepwiki.com/badlogic/pi-mono/5-pi-tui:-terminal-ui-library) · [Kontras jejak Electron](https://blog.openreplay.com/comparing-electron-tauri-desktop-applications/)

Vonis final riset

**Bisa, dan appearance bukan alasan untuk jadi berat.** Sistem temanya meniru format Pi yang sudah terbukti (satu JSON per tema, `vars` + `colors`, hot reload, slot dark/light) dengan token dipangkas dari 66 ke ±38 dan perilaku fallback yang lebih ramah daripada OMP. Status line-nya mengambil yang terbaik dari dua dunia yang tidak dimiliki satu pun agent secara lengkap: konfigurasi segmen bawaan ala OMP *dan* hook perintah eksternal ala Claude Code (yang harus diciptakan ulang pihak ketiga untuk OMP, dan tidak ada di Pi maupun OpenCode), plus segmen sisa budget sebagai pembeda. Dan “ringan” ditulis sebagai **budget yang dites di CI** — cold start \<300 ms, idle RSS \<100 MB, binary \<60 MB — karena risetnya menunjukkan klaim ringan OMP itu relatif: binary terukur ±183 MB dan baseline RSS terestimasi 40–90 MB. Agent ini bisa secara kredibel lebih ringan justru karena tidak membawa baterai-baterai OMP. Masuk plan sebagai **Fase 15**.

## B Peta rilis

Satu fase dikerjakan sampai kriteria selesainya hijau sebelum lanjut. Tidak ada fase yang dikerjakan paralel dengan fase lain.

v0.1

FASE 0 – 3 · INTERNAL

Skeleton, model layer + preset 9Router, agent loop dan tool inti, permissions dan mode. Agent pertama kali bisa kerja end-to-end.

v0.2

FASE 4 – 7 · PEMBEDA AKTIF

Context management, sesi yang bisa dipindah, hard budget + **combo fallback bernama**, dan verification gate. Di sinilah agent ini mulai beda dari pasaran.

v0.3

FASE 8 – 10

MCP client, antarmuka headless dan TUI Ink, lalu primitif subagent sebagai fondasi orchestration.

v0.4

FASE 11 · ORCHESTRATION

Coordinator-worker ala Orca: Run/Task/Dispatch, worktree per writer, integrasi manual terpicu user.

v0.5

FASE 12 – 13 · OBSERVABILITY

Dashboard `/stats` lokal ala Oh My Pi (usage per model + RAM proses + mesin) dan tracking frustrasi per model dengan saran ganti model.

v0.6

FASE 14 · DISCORD RPC

Discord Rich Presence lengkap: status agent, model, token, dan timer sesi di profil Discord lewat IPC lokal hand-rolled, dengan privasi per field dan mode Incognito.

v0.7

FASE 15 · APPEARANCE & RINGAN

Sistem tema ala Pi yang dipangkas (±38 token, 5 bawaan, file user + proyek, hot reload, slot dark/light), status line dua lapis (segmen terkonfigurasi termasuk sisa budget + hook perintah eksternal kompatibel Claude Code), dan budget performa tertulis yang jadi gerbang CI.

## C Prinsip yang tidak boleh dilanggar

Berlaku di semua fase. Kalau sebuah tugas di file eksekusi nanti bertabrakan dengan prinsip ini, prinsip yang menang.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTIiIHJ4PSIyIj48L3JlY3Q+PHBhdGggZD0iTTIgMjBoMjAiPjwvcGF0aD48L3N2Zz4=)

**Windows kelas satu sejak hari pertama.** Mesin utama yang dipakai Windows, dan agent pasaran kronis rusak di sana. Uji di Windows pada tiap fase, bukan di akhir.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNNCAxN2w2LTUtNi01Ij48L3BhdGg+PHBhdGggZD0iTTEyIDE5aDgiPjwvcGF0aD48L3N2Zz4=)

**Headless mode bersih.** Stdout hanya untuk output terstruktur (JSONL), semua log ke stderr. Skrip yang mem-parse output tidak boleh ketemu sampah log.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjBoOSI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDMuNWEyLjEgMi4xIDAgMCAxIDMgM0w3IDE5bC00IDEgMS00WiI+PC9wYXRoPjwvc3ZnPg==)

**Edit file harus aman.** Read-before-write, cek hash atau isi tidak berubah sejak dibaca, match unik, format edit per model bila perlu. Jangan pernah pakai unified diff mentah bernomor baris.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjJzOC0zLjYgOC0xMFY1bC04LTMtOCAzdjdjMCA2LjQgOCAxMCA4IDEwWiI+PC9wYXRoPjxwYXRoIGQ9Im05IDEyIDIgMiA0LTQiPjwvcGF0aD48L3N2Zz4=)

**File test dilindungi, ditegakkan runner.** Agent tidak boleh mengubah file test dan config test yang masuk daftar lindung lewat tool apa pun, termasuk bash. Runner memeriksa hash-nya; tool edit yang menolak hanyalah lapis pertama. Ini fondasi verification gate di Fase 7.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgNiA5IDE3bC01LTUiPjwvcGF0aD48L3N2Zz4=)

**Tiap fase selesai dengan verifikasi yang bisa dijalankan**: test suite, perintah contoh dengan output yang diharapkan. Bukan "seharusnya jalan".

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5Ij48L2NpcmNsZT48cGF0aCBkPSJNMTIgN3Y1bDMgMyI+PC9wYXRoPjwvc3ZnPg==)

**Bite-sized, tidak one-shot.** Tiap tugas dipecah jadi langkah kecil dengan file yang disebut eksplisit, langkah verifikasi, dan commit di akhir tugas.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNMTIgMTRsNC00Ij48L3BhdGg+PHBhdGggZD0iTTMuMyAxOWExMCAxMCAwIDEgMSAxNy40IDAiPjwvcGF0aD48L3N2Zz4=)

**Performa adalah gerbang sejak Fase 0.** Waktu `--version`, idle RSS, dan ukuran binary diukur di CI tiap PR dan dibandingkan dengan baseline. Dependensi runtime baru butuh alasan tertulis di issue atau ADR.

![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNiAzdjEyIj48L3BhdGg+PGNpcmNsZSBjeD0iMTgiIGN5PSI2IiByPSIzIj48L2NpcmNsZT48Y2lyY2xlIGN4PSI2IiBjeT0iMTgiIHI9IjMiPjwvY2lyY2xlPjxwYXRoIGQ9Ik0xOCA5YTkgOSAwIDAgMS05IDkiPjwvcGF0aD48L3N2Zz4=)

**Spec di repo, status di Issues.** Plan dan file MD per fase adalah spesifikasi: berversi dan diubah lewat PR. GitHub Issues adalah status kerja: satu issue per task, ditutup oleh PR. Issue menautkan ke spec, tidak menyalin langkah-langkahnya.

## D Rencana per fase

Tiap fase: tujuan, tugas kecil bernomor, dan kriteria selesai. Kriteria selesai adalah gerbang: fase berikutnya tidak mulai sebelum gerbang ini hijau.

### Fase 0 · Skeleton repo dan harness

Repo hidup, CLI kosong jalan, harness test dan mock provider siap.

Rilis: v0.1

#### Tugas kecil

1.  \[diubah\] Inisialisasi paket TypeScript **Bun-only** (ADR-001), `tsconfig` strict, linter + formatter, `bun test`.
2.  \[diubah\] Entry CLI dengan parser argumen; `--version` dan `--help` jalan dan hanya memuat modul minimum (semua yang berat di-lazy-import sejak hari pertama).
3.  \[diubah\] Loader config **JSONC** (ADR-005), global + proyek (proyek menang), skema zod, field `version` untuk migrasi; config kosong valid.
4.  **Mock provider server** untuk test: server HTTP lokal yang meniru endpoint OpenAI-compatible dan Anthropic dengan respons terekam. Dipakai semua fase berikutnya.
5.  \[baru\] **Spike ukuran dan startup (setengah hari):** hello-world `bun build --compile` di Linux, Windows, dan macOS; catat ukuran binary, waktu `--version`, dan idle RSS ke `docs/perf/baseline.json`. Target absolut binary ditetapkan dari angka ini (ADR-006).
6.  \[baru\] **Spike renderer (setengah hari, ADR-003):** prototipe transkrip streaming + input di atas paket pi-tui dan di atas renderer diferensial minimal sendiri; ukur latensi ketikan dan ukuran bundle; perbarui `docs/adr/` dengan hasilnya.
7.  \[baru\] **Deteksi Git Bash di Windows** (ADR-004): path dari config → lokasi instal Git yang umum → `PATH`; bila tidak ada, error yang bisa ditindaklanjuti.
8.  \[diubah\] Skrip `test`, `typecheck`, `lint`, `build`, `perf` di package.json; CI GitHub Actions matriks Linux + Windows dengan **job perf** yang gagal bila waktu `--version`, idle RSS, atau ukuran binary regresi \>20% dari baseline.
9.  \[baru\] **Alur kerja repo:** `CLAUDE.md`, `.gitattributes` (fixture CRLF tidak dinormalisasi), template issue/PR, label + milestone per fase, proteksi branch `main` (paket starter di bagian G).

Kriteria selesai

`agent --help` jalan di Windows dan Linux; test suite hijau; mock server merespons di kedua bentuk protokol; `docs/perf/baseline.json` terisi dan job perf CI terbukti gagal pada regresi yang disimulasikan; ADR-003 dan ADR-006 diperbarui dengan data spike; di Windows tanpa Git, CLI memberi error Git Bash yang jelas.

### Fase 1 · Model layer dan provider, termasuk preset 9Router

Agent bisa memanggil model lewat endpoint mana pun dan tahu batas konteks aslinya.

Rilis: v0.1

#### Tugas kecil

1.  Tipe pesan kanonik internal + fungsi transformasi ke format wire OpenAI dan Anthropic, dengan test unit per transformasi (system prompt, tool args JSON object vs string, tool_result, stop reason, streaming delta).
2.  \[diubah\] **Adapter OpenAI-compatible sendiri** (ADR-002): `fetch` + parser SSE, delta tool call yang terpotong lintas chunk, `stream_options.include_usage`, `AbortSignal` untuk batal.
3.  \[diubah\] **Adapter Anthropic Messages sendiri**: wajib `max_tokens`, blok thinking + signature disimpan dan di-echo apa adanya ke Anthropic, header versi API.
4.  \[diubah\] Blok config provider ala OpenCode (JSONC) + resolusi apiKey dari env; penemuan model via `GET /v1/models`.
5.  **Preset 9Router bawaan**: baseURL `http://localhost:20128/v1`, apiKey dari dashboard, model `ag/*` (Antigravity), `kr/*`, dan lain-lain terdokumentasi; override context window per model.
6.  \[baru\] **Katalog metadata model:** snapshot `models.dev` dibundel saat build (context window, harga, kapabilitas tool/reasoning/vision); override lokal di config selalu menang; ID yang tidak dikenal mendapat nilai konservatif + peringatan.
7.  \[baru\] **Catat model aktual:** field model dari respons disimpan terpisah dari model yang diminta, karena 9Router atau gateway lain bisa fallback diam-diam di sisinya.
8.  \[diubah\] Penghitung token: heuristik karakter-per-token per keluarga model, dikalibrasi otomatis dari field `usage` respons; `js-tiktoken` hanya opsional dan dimuat malas.
9.  Probe kapabilitas di awal sesi: model tanpa tool calling native jatuh ke tangga fallback (prompted JSON tool call, lalu mode chat-only dengan peringatan keras).

Kriteria selesai

Satu prompt yang sama menghasilkan tool call yang benar lewat (a) mock OpenAI, (b) mock Anthropic, (c) 9Router lokal asli bila tersedia; estimasi token dalam 15% dari `usage` yang dilaporkan provider pada fixture uji.; fixture respons yang field model-nya berbeda dari yang diminta tercatat sebagai model aktual; tidak ada dependensi AI SDK di `package.json`.

### Fase 2 · Agent loop dan tool inti

Agent bisa menyelesaikan tugas file sederhana end-to-end.

Rilis: v0.1

#### Tugas kecil

1.  \[diubah\] Loop manual `while(true)`, satu panggilan model per putaran; streaming ke REPL; Esc/Ctrl+C membatalkan lewat `AbortSignal`, termasuk menutup tool_use yang menggantung dengan tool_result sintetis “dibatalkan”.
2.  Registry tool tunggal (tool bawaan dan tool MCP masuk registry yang sama nanti).
3.  \[diubah\] Tool read (penomoran baris dan batas), write, edit (read-before-write + cek hash + match unik). **Windows:** gaya newline asli dipertahankan (CRLF tetap CRLF; match dilakukan setelah normalisasi lalu ditulis balik dengan gaya aslinya), BOM dipertahankan, path dinormalisasi (separator, huruf drive, case-insensitive).
4.  \[diubah\] Tool bash: Git Bash di Windows (ADR-004), timeout, output ditangkap, environment dibersihkan; batal atau timeout **membunuh seluruh pohon proses** (process group di POSIX, `taskkill /T /F` di Windows).
5.  Tool grep (ripgrep), glob, list.
6.  Tool webfetch dan todowrite.
7.  Pemotongan output tool: maks 2000 baris / 50KB, sisanya tumpah ke file dan dirujuk.
8.  \[diubah\] **Diagnostik pasca-giliran, bukan per edit:** perintah opsional per proyek di config (mis. `tsc --noEmit`, `cargo check`) dijalankan sekali di akhir giliran yang mengubah file, dengan timeout; hasilnya disuntik ke giliran berikutnya. Tidak ada klien LSP di v1 (backlog).
9.  \[baru\] **Checkpoint file dan `/rewind`:** sebelum write/edit pertama per giliran, isi file yang akan disentuh disalin ke penyimpanan checkpoint sesi; `/rewind` memulihkan file dan memotong percakapan ke titik pilihan. Efek samping bash tidak bisa di-rewind dan UI menyatakannya.
10. \[baru\] **REPL minimal (readline) + headless dasar `--print`** (teks akhir ke stdout, log ke stderr): antarmuka sementara sampai TUI Fase 9, sekaligus tempat prompt persetujuan Fase 3.
11. \[baru\] **Eval harness v0:** 15–30 tugas kecil di repo fixture (perbaiki bug, tambah fungsi + test) dijalankan headless terhadap model asli lewat 9Router atau API; skor dari test tiap tugas; hasil dicatat di `docs/evals/`. Bukan gerbang CI (non-deterministik dan berbayar), tapi wajib dijalankan sebelum menutup fase yang menyentuh prompt, tool, atau loop.

Kriteria selesai

Skenario uji end-to-end di mock: agent membaca file, mengedit, menjalankan test fixture, dan berhenti dengan jawaban teks; skenario batal (Esc) tidak merusak sesi. Fixture file CRLF tetap CRLF setelah edit; fixture timeout bash membunuh proses cucu di Windows dan Linux; `/rewind` memulihkan file fixture; baseline eval pertama tercatat.

### Fase 3 · Permissions dan mode

Tidak ada aksi mengejutkan; user memegang kendali.

Rilis: v0.1

#### Tugas kecil

1.  Aturan allow/ask/deny per tool dari config, urutan evaluasi deny \> ask \> allow.
2.  \[diubah\] Mode default, acceptEdits, plan, bypass (pola mode Claude Code yang disederhanakan). Bypass hanya lewat flag eksplisit per sesi, dan checkpoint Fase 2 tetap aktif di mode itu.
3.  Mode plan: hanya boleh menulis file rencana di folder khusus; tool edit lain ditolak.
4.  \[diubah\] File `.env` dan pola sensitif: deny bawaan untuk read/write/edit; perintah bash yang argumennya cocok pola sensitif (terdeteksi parser) jatuh ke ask.
5.  \[diubah\] **Parsing perintah bash dengan tree-sitter-bash (WASM, dimuat malas) sejak awal:** pisahkan `&&`, `||`, `;`, `|`, subshell, `$( )`, backtick, dan redirect, lalu nilai per perintah. Apa pun yang tidak bisa diurai dengan yakin (`eval`, `bash -c`, ekspansi variabel di posisi perintah) jatuh ke ask, tidak pernah ke allow. Regex bukan pengaman.
6.  \[diubah\] Prompt persetujuan di REPL Fase 2 (lalu TUI Fase 9) dengan pilihan sekali / selalu untuk pola ini / tolak.
7.  \[baru\] **Konten tak tepercaya:** output webfetch (dan MCP di Fase 8) dibungkus dan diberi label tak tepercaya di prompt; di mode default, tool yang mengubah file atau menjalankan perintah pada giliran yang sama setelah konten tak tepercaya masuk selalu ask, walau ada aturan allow.

Kriteria selesai

Matriks test izin lulus (per tool x per mode x per aturan); mode plan terbukti tidak bisa mengedit kode pada fixture.; fixture perintah majemuk yang menyembunyikan aksi (`$(…)`, `bash -c`, redirect ke path sensitif) terbukti jatuh ke ask.

### Fase 4 · Context management

Sesi panjang tidak meledak dan tidak lupa hal penting.

Rilis: v0.2

#### Tugas kecil

1.  \[diubah\] Perakitan system prompt berlapis: blok env (OS, cwd, git status ringkas), instruksi, prompt per provider; prefix stabil di depan demi cache. System prompt dan deskripsi tool disimpan sebagai file berversi di `prompts/`, bukan string tersebar di kode; tiap perubahan dijalankan lewat eval harness Fase 2 dan hasilnya dicatat.
2.  Loader instruksi AGENTS.md lalu CLAUDE.md (hirarki folder), disuntik sebagai instruksi.
3.  Pruning bertingkat: (a) potong atau buang output tool lama di atas ambang sekitar 40k token, (b) micro-compact, (c) ringkasan penuh oleh panggilan model terpisah (compaction agent).
4.  Ambang autocompact dapat dikonfigurasi (persentase konteks), bukan angka mati.
5.  Setelah compaction: suntik ulang instruksi proyek + daftar todo aktif + ringkasan.

Kriteria selesai

Fixture sesi sintetis 300 langkah tetap di bawah ambang konteks setelah compaction (dengan summarizer mock deterministik), dan fakta kunci yang ditandai di fixture terbukti ada di konteks pasca-compact (cek mekanis). Eval “ingat fakta setelah compact” dengan model asli dijalankan dan skornya dicatat, bukan dijadikan gerbang biner.

### Fase 5 · Sesi: persistensi, resume, export/import

Pekerjaan tidak hilang dan bisa dipindah.

Rilis: v0.2

#### Tugas kecil

1.  \[diubah\] Format JSONL sesi terdokumentasi: field versi skema di setiap record + migrasi maju; skema v1 ditulis sebagai dokumen publik di repo.
2.  Simpan transkrip append-only per sesi di direktori data user; metadata sesi (model, provider, cwd, waktu).
3.  \[diubah\] **Record mentah per request disimpan apa adanya** (fondasi Fase 12 dan 13): provider + model yang diminta *dan* model aktual dari respons (Fase 1), timestamp, token input/output/cache-read/cache-write/reasoning bila ada, durasi, TTFT, stop reason, panggilan tool — plus teks pesan user untuk rollup frustrasi nanti. Tidak ada agregat yang disimpan menggantikan record mentah ini.
4.  \[baru\] **Redaksi secret sebelum ditulis:** nilai env yang bernama rahasia (`*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`) dan pola umum (kunci API berprefiks, private key PEM) diganti `[REDACTED:jenis]` di transkrip, export HTML, dan nantinya `stats.db`.
5.  \[baru\] Checkpoint/rewind, perpindahan model, dan keputusan persetujuan dicatat sebagai record bertipe (fondasi sinyal perilaku Fase 13).
6.  Perintah resume/continue dan fork dari titik mana pun.
7.  Export ke JSON portabel + render HTML statis self-hosted untuk dibaca ulang (replay); import dari export yang sama.

Kriteria selesai

Sesi dibuat, di-fork, di-export, di-import di mesin atau folder lain, dan dilanjutkan tanpa kehilangan langkah; format terdokumentasi cukup untuk ditulis ulang oleh pihak ketiga.; fixture output tool berisi API key palsu terbukti ter-redaksi di JSONL dan export.

### Fase 6 · Pembeda 1: hard budget dan combo fallback bernama

Celah pasar nomor 1 dan 2 ditutup: run yang bisa direm, dan model yang bisa ganti di tengah sesi lewat combo yang diatur user sendiri di file config — pengemasan nama virtual ala 9Router, mekanik ala `retry.fallbackChains` OMP.

Rilis: v0.2 · Pembeda

#### Tugas kecil

1.  \[diubah\] Akuntansi usage per langkah dan per **model aktual** (token masuk/keluar/cache); estimasi biaya dari katalog Fase 1 + override; model langganan tanpa harga tercatat N/A.
2.  \[diubah\] **Budget per run dengan unit default token dan jumlah giliran**, yang berlaku untuk semua model termasuk langganan 9Router; dolar opsional dan hanya menghitung model berharga. Aksi saat tembus: berhenti keras, atau turun ke entri lebih murah di combo aktif (langkah setelah turun tetap dihitung ke budget).
3.  \[diubah\] **Skema combo di file config** (JSONC, bisa diedit tangan; bukan dashboard-only seperti 9Router): nama combo, `strategy` (`fallback` dulu; `round-robin` opsional), daftar terurut penyeleksi `provider/model` yang bebas mencampur provider/langganan/API/gratis, `fallbackOn` per combo, `revertPolicy`. Combo satu entri valid sebagai alias; nama combo bisa dipakai di mana pun penyeleksi model bisa dipakai, termasuk mengisi role (`default`, `smol`, dst).
4.  \[diubah\] **Mekanik penelusuran:** per entri, retry pendek hanya untuk error transien 502/503/504 (maks 2, backoff 0,5 → 2 detik); **429 langsung pindah entri**, kecuali `Retry-After` ≤5 detik (tunggu sekali); `Retry-After` yang lebih panjang menjadi durasi cooldown entri itu. Rotasi kredensial di dalam satu provider dicoba sebelum fallback model; kandidat yang sedang cooldown, tanpa kredensial, atau tidak kompatibel diskip; resolusi rantai berdasar spesifisitas (model persis \> `provider/*` \> role \> `default`); perubahan config di-reload untuk keputusan fallback berikutnya. Default OMP (10× sampai 300 detik) sengaja tidak ditiru: inti combo adalah pindah cepat.
5.  **Kondisi pemicu dibedakan dari error biasa:** strategi `fallback` hanya berjalan pada 429 dan error transien 502/503/504 (plus `quota` / `no-credential` bila `fallbackOn` mengizinkan; mode OMP: `any` \| `usage-limit` \| `except-usage-limit`); error seperti 400 dikembalikan ke user langsung, tidak menelusuri rantai. Tiap entri ikut satu penelusuran paling banyak sekali (retry pendek di atas termasuk di dalamnya). Kebijakan revert: `cooldown-expiry` (kembali ke model utama saat cooldown-nya berakhir) atau `never`.
6.  \[baru\] **Normalisasi transkrip saat model berganti:** blok thinking bersignature hanya dikirim ke provider dan keluarga model yang sama, selain itu dibuang; ID tool call dipetakan ulang ke format yang diterima target; bila context window target lebih kecil dari pemakaian sekarang, compaction Fase 4 dijalankan sebelum request; user diberi tahu bahwa cache prompt hangus, beserta estimasi biaya tambahannya.
7.  \[baru\] **Gagal di tengah streaming:** pesan assistant parsial dikeluarkan dari konteks (dicatat di transkrip sebagai `aborted`), tool yang sudah selesai dieksekusi tidak diulang, dan entri berikutnya melanjutkan dari state terakhir yang ter-commit.
8.  \[baru\] **Fallback bersarang:** bila entri combo menunjuk combo 9Router (yang fallback sendiri di sisi router), agent memperingatkan sekali dan memakai model aktual dari respons untuk akuntansi dan atribusi.
9.  Budget per combo opsional (harian/bulanan, pola dashboard 9Router): saat batas kena, entri berbayar diskip demi entri gratis di combo yang sama.
10. Setiap perpindahan model dicatat di transkrip (dari model apa, ke model apa, pemicunya apa) dan diberitahukan ke user; perintah atau status UI menampilkan sisa budget dan posisi combo saat ini secara live.
11. Preset combo contoh di dokumentasi: satu combo “langganan → murah → gratis” yang menunjuk preset 9Router (termasuk entri `ag/*`), supaya user bisa menyalin dan mengubah urutannya sendiri.

&nbsp;

    // config.jsonc — combo sebagai model virtual bernama
    {
      "combos": {
        "premium-coding": {
          "strategy": "fallback",            // fallback | round-robin
          "models": [
            "anthropic/claude-opus-4-5",
            "openai/gpt-5.5",
            "glm/glm-4.7"
          ],
          "fallbackOn": [429, 502, 503, 504, "quota", "no-credential"],
          "revertPolicy": "cooldown-expiry"
        },
        "free-only": { "models": ["kr/claude-sonnet-4.5", "oc/auto"] }
      },
      "modelRoles": {
        "default": "premium-coding",         // nama combo sah di mana pun model sah
        "smol": "free-only"
      },
      "budget": { "sessionTokens": 2000000, "sessionTurns": 200, "sessionUsd": null }
    }

Kriteria selesai

Fixture dengan budget kecil membuktikan run berhenti atau turun model persis di ambang; fixture mock yang mengembalikan 429 lalu 503 membuktikan combo berjalan berurutan dan berhenti di model pertama yang sehat, sementara fixture 400 membuktikan rantai *tidak* ditelusuri; fixture cooldown membuktikan model utama dipakai lagi setelah cooldown berakhir pada `revertPolicy: cooldown-expiry`; transkrip mencatat semua perpindahannya; tidak ada langkah yang jalan setelah budget habis pada mode berhenti keras. Fixture pindah dari Anthropic (dengan thinking bersignature) ke OpenAI-compatible membuktikan request berikutnya valid; fixture stream terputus di tengah membuktikan tool tidak dieksekusi ulang; fixture 429 dengan `Retry-After` panjang membuktikan pindah entri tanpa menunggu; budget token berlaku untuk model tanpa harga.

### Fase 7 · Pembeda 2: verification gate

Agent tidak bisa memproklamirkan selesai tanpa bukti.

Rilis: v0.2 · Pembeda

#### Tugas kecil

1.  \[diubah\] Daftar file terlindungi di config: file test **dan config test** (mis. `vitest.config.*`, `jest.config.*`, `scripts.test` di package.json, fixture). Tool edit/write menolak mengubahnya; karena bash bisa menulis file apa pun, runner juga mengambil snapshot hash file terlindungi di awal tugas.
2.  Perintah verifikasi proyek (test/typecheck/lint) didefinisikan di config.
3.  Gate di akhir tugas: sebelum agent boleh menyatakan selesai, verifikasi dijalankan oleh runner (bukan oleh model); gagal berarti tugas dikembalikan ke loop dengan output kegagalan, maksimal sekian percobaan, lalu dilaporkan sebagai gagal, bukan sukses.
4.  \[baru\] **Cek hash sebelum verifikasi:** file terlindungi yang berubah lewat tool apa pun membuat gate gagal dengan alasan “file terlindungi diubah”; file dipulihkan dari snapshot awal tugas, lalu verifikasi dijalankan atas versi asli. Menambah file test baru boleh; menghapus, `.skip`, atau `.only` pada file terlindungi tertangkap oleh hash yang sama.
5.  Laporan akhir tugas selalu menyertakan hasil verifikasi terakhir.

Kriteria selesai

Fixture agent yang mengakali test lewat tool edit, lewat bash (`sed -i`, redirect, `git checkout`), dan lewat config test (menambah exclude) semuanya terdeteksi, gate gagal, dan file dipulihkan; fixture test gagal membuat gate menolak penyelesaian sampai percobaan habis.

### Fase 8 · MCP client

Tool eksternal standar industri tersedia.

Rilis: v0.3

#### Tugas kecil

1.  Klien MCP (stdio dulu) via `@modelcontextprotocol/sdk`; server didefinisikan di config.
2.  Tool dari server MCP masuk registry yang sama, tunduk pada permission yang sama.
3.  Resource dan prompt MCP dipetakan seperlunya (tool adalah prioritas).

Kriteria selesai

Satu server MCP contoh (filesystem atau fetch) terhubung, tool-nya bisa dipanggil agent, dan permission ask bekerja untuk tool tersebut.

### Fase 9 · Antarmuka: headless lengkap, lalu TUI

Bisa dipakai skrip dan manusia.

Rilis: v0.3

#### Tugas kecil

1.  \[diubah\] Mode headless `--print` dengan `--output-format json` (JSONL di stdout, log di stderr), exit code bermakna. Melengkapi headless dasar dari Fase 2.
2.  \[diubah\] TUI v1 di atas renderer diferensial ADR-003 (bukan Ink): transkrip streaming, indikator langkah/tool, prompt persetujuan, input menyela di tengah putaran masuk antrean, Esc membatalkan; blok transkrip yang selesai di-commit ke scrollback terminal sejak awal.
3.  \[baru\] **Gerbang latensi TUI masuk CI di sini, bukan di Fase 15:** ketikan → cat \<16 ms p95 dan ≤30 paint/detik saat streaming, diukur dengan tes PTY di Linux dan Windows.
4.  Perintah garis miring minimal: `/model`, `/budget`, `/export`, `/resume`, `/plan`, `/build`, `/rewind`.

Kriteria selesai

Skenario headless dipakai dari skrip shell dan output-nya parseable; skenario TUI interaktif lulus uji manual tercatat (checklist di repo) di Windows.; tes PTY latensi ketikan lulus di Linux dan Windows.

### Fase 10 · Primitif subagent

Fondasi orchestration, tanpa orchestration dulu.

Rilis: v0.3

#### Tugas kecil

1.  Subagent sebagai fungsi: context segar (system prompt sendiri + instruksi proyek), menerima brief terstruktur (objektif, format output, tool yang boleh, batasan eksplisit).
2.  Definisi agent dalam Markdown + frontmatter (pola `.claude/agents`): tools, model, maxTurns, permission mode.
3.  Batasan keras: konkurensi maks dapat dikonfigurasi (default kecil), kedalaman 1 (subagent tidak bisa membuat subagent), maxTurns dengan pengembalian hasil parsial.
4.  Agent bawaan read-only Explore untuk riset codebase.
5.  Hanya pesan terakhir subagent yang kembali ke pemanggil, ditambah metadata (langkah, token terpakai).

Kriteria selesai

Tugas riset fixture diselesaikan subagent Explore tanpa menyentuh file; pemanggil menerima ringkasan + metadata; batas kedalaman dan konkurensi terbukti oleh test.

### Fase 11 · Orchestration v1 (fase lanjutan, setelah Fase 10 stabil)

Coordinator-worker yang aman untuk satu user.

Rilis: v0.4

#### Tugas kecil

1.  \[diubah\] Store SQLite terisolasi (satu modul, `bun:sqlite`) dengan tabel bergaya Orca: runs, tasks (spec + dependensi), dispatches, messages, gates disederhanakan.
2.  Status task: pending, ready, dispatched, completed, failed, blocked; promosi dependensi otomatis (pending ke ready saat dependensi selesai).
3.  Protokol penyelesaian bertipe: `worker_done` tepat satu kali per dispatch, wajib outcome succeeded/failed, ringkasan, filesModified, hasil test; otoritas penyelesaian memeriksa pasangan taskId + dispatchId.
4.  Heartbeat worker dari runner; deteksi macet; circuit breaker: task failed setelah 3 kegagalan beruntun.
5.  Worktree manager: satu worktree per writer (maks 3 writer paralel), branch bernama konsisten, file scope dideklarasikan di muka per task; reader dan fan-out read-only tanpa worktree.
6.  Mode coordinator sebagai mode CLI: memecah objektif menjadi task (dengan brief terstruktur Fase 10), dispatch, menunggu event (worker_done/escalation/question) dengan model blocking wait, dan mengajukan pertanyaan blocking worker sebagai task blocked.
7.  Integrasi manual terpicu user: merge worktree satu per satu mengikuti urutan dependensi, test suite dijalankan setelah tiap merge; konflik menghentikan proses dan dilaporkan, tidak pernah diselesaikan diam-diam.
8.  Budget token per run orchestration (memakai Fase 6) dan laporan akhir per task.

Kriteria selesai

Skenario fixture 3 task (2 paralel, 1 bergantung) selesai end-to-end: dispatch, heartbeat, worker_done bertipe, integrasi berurutan dengan test hijau setelah tiap merge; skenario konflik terbukti berhenti dan melapor, bukan memaksa.

### Fase 12 · Dashboard `/stats` lokal: usage per model + RAM

Meniru pola omp-stats persis (Bun + SQLite rollup + server lokal), ditambah panel resource proses dan mesin yang tidak dimiliki OMP maupun agent lain.

Rilis: v0.5

#### Tugas kecil

1.  **Mesin sinkronisasi:** baca JSONL sesi dari Fase 5 secara inkremental (kursor per file tersimpan, file yang tidak berubah diskip, commit atomik supaya sinkronisasi yang terputus tidak menghitung dobel) ke SQLite lewat `bun:sqlite` di modul terisolasi yang sama dengan Fase 11; tabel rollup per jam untuk pesan, tool, dan sesi; watcher menyinkronkan transkrip yang sedang ditulis.
2.  **Server lokal Bun:** perintah `stats` di shell dan slash command `/stats` di dalam sesi membuka dashboard yang sama, disajikan `Bun.serve`, bind default `127.0.0.1` dengan port default yang bisa diganti (`--port`) dan bind lain hanya lewat `--host` eksplisit; URL yang efektif (dari `server.url` / `server.port` setelah bind) dicetak ke terminal. Kalau port terisi, pakai dashboard yang sudah jalan atau pilih port bebas. Mode non-dashboard: `stats --summary` (konsol) dan `stats --json`, keduanya sinkronisasi dulu baru mencetak.
3.  **API HTTP:** `GET /api/stats`, `/api/stats/models`, `/api/stats/folders`, `/api/stats/timeseries`, `/api/status`, `POST /api/sync`, dan `GET /api/events` sebagai SSE (progres sinkronisasi + versi data); halaman me-revalidasi saat versi data berubah, tanpa tombol refresh.
4.  \[baru\] **Keamanan server lokal:** tolak request yang header `Host`-nya bukan `127.0.0.1`/`localhost` + port (cegah DNS rebinding); POST hanya dari `Origin` yang sama; token acak per proses wajib di URL pertama dan ditukar menjadi cookie `HttpOnly; SameSite=Strict`; tanpa CORS. `--host` non-loopback hanya dengan token dan peringatan eksplisit, karena halaman Traces memuat isi prompt.
5.  **Halaman dashboard:** Overview, Models, Providers, Costs, Requests, Errors, Traces, Tools, Projects, Gain, dan halaman Resource baru (tugas 5). Pilihan rentang waktu membaca rollup per jam, bukan memindai ulang transkrip. Biaya selalu dilabeli “estimasi setara API”; model langganan tanpa harga publik tampil `N/A` dan tidak masuk total dolar.
6.  **Metrik per model/provider** mengikuti definisi omp-stats: jumlah request; token input/output/cache-read/cache-write; biaya; Tokens/s = `output_tokens / (duration/1000)`; Cache Rate dan Cache Savings; Error Rate = `count(stopReason=error) / total_calls * 100`; Avg Latency dan TTFT. Konteks % tetap di footer TUI/status bar, bukan dipindah ke dashboard.
7.  **Panel Resource (pekerjaan baru, tidak ada di OMP):** sampler interval 500ms–1s menyimpan ring buffer pendek. Proses sendiri: `process.memoryUsage()` dengan `rss` sebagai angka utama, `heapTotal`/`heapUsed`/`external` sebagai rincian (di Bun boleh ditambah `bun:jsc` `heapStats()`); CPU% proses dari selisih dua sampel `process.cpuUsage()`. Mesin: `os.totalmem()`/`os.freemem()` dan CPU% dari diff `os.cpus()`. Sparkline di footer TUI + seri penuh di halaman Resource.
8.  **Aturan lintas platform untuk panel Resource:** di Windows (`win32`) field load average disembunyikan karena `os.loadavg()` selalu `[0, 0, 0]` di sana; angka heap tidak pernah dibandingkan lintas runtime (Bun = heap JavaScriptCore, Node = V8); UI menyatakan eksplisit bahwa RSS proses induk belum termasuk proses anak (shell, server MCP, subagent) — penjumlahan pohon proses dan pustaka `systeminformation` adalah peningkatan opsional belakangan, bukan diam-diam dianggap sudah termasuk.

Kriteria selesai

Dari fixture sesi yang diketahui isinya: dashboard lokal terbuka di `127.0.0.1`, angka per model di halaman Models cocok dengan hitungan tangan dari fixture (token, request, error rate), estimasi biaya dan label `N/A`-nya benar; sinkronisasi kedua atas file yang sama tidak mengubah angka (idempoten); panel Resource menampilkan RSS proses yang berubah saat fixture membebani memori, dan di Windows tidak ada field load average yang tampil. Uji jalan di Windows dan Linux. Request dengan `Host` asing atau POST tanpa `Origin` yang sama ditolak (fixture DNS rebinding/CSRF).

### Fase 13 · Pembeda 3: tracking frustrasi per model + saran ganti model

Meng-copy lapis pengukuran frustrasinya OMP (yang sudah terbukti), lalu menutup celah yang belum diklaim siapa pun: mengubah sinyal frustrasi menjadi saran ganti model di dalam sesi.

Rilis: v0.5 · Pembeda

#### Tugas kecil

1.  **Ekstraksi prosa:** dari record pesan user Fase 5, buang fence kode, kode inline, tag XML/HTML, URL, mention file, token bertitik, baris kutipan, penanda gambar, dan escape ANSI sebelum penilaian; yang dinilai hanya prosa sisanya, dengan pencocokan word-boundary case-insensitive.
2.  \[diubah\] **Sinyal heuristik lokal** (regex, gratis, instan, tanpa data keluar mesin) mengikuti set OMP: yelling (kalimat mayoritas CAPS multi-kata), profanity (daftar terkurasasi termasuk varian tersensor; slur identitas dan kata teknis korpus coding dikecualikan), anguish (`!!!`, `noooo`, `ugh`, `argh`, `dude`, `:(`), negation (pembuka `no`/`nope`/`wrong`, `makes no sense`), repetition (`like i said`, `i already told you`, `still doesnt`), blame (`you didn't`, `why did you`, `stop X-ing` di awal kalimat). **Guard:** pesan ≥3 baris prosa dinolkan sinyal emosionalnya. **Pola disimpan sebagai leksikon data per bahasa** (`lexicons/en.json`, `lexicons/id.json`), bukan regex tertanam: minimal Inggris dan Indonesia di v1 (mis. negation *salah*, *bukan gitu*; repetition *udah gw bilang*, *kan tadi udah*; blame *kok kamu*, *kenapa kamu*; anguish *astaga*, *aduh*), dan user bisa menambah leksikon sendiri.
3.  \[diubah\] **Tiga bucket bersarang per pesan:** annoyed = sinyal apa pun menyala; annoyed-at-assistant = pola negation + repetition + blame; angry = at-assistant dan (profanity atau yelling). Atribusi: ke model yang sedang diajak bicara user pada pesan itu (mengikuti pergantian model di tengah sesi); agregasi per *versi model* (varian provider dari revisi yang sama digabung), dengan jumlah pesan minimum sebelum sebuah laju ditampilkan. Atribusi memakai model aktual dari respons (Fase 1), bukan model yang diminta.
4.  **Sinyal perilaku dari log sesi** (tanpa NLP sama sekali): frekuensi rewind/undo dan revert edit, diff git yang dibuang setelah giliran agent, prompt nyaris identik yang dikirim ulang, pergantian model manual tepat setelah sebuah giliran, sesi yang ditinggal di tengah tugas, dan interupsi user setelah error tool berulang. Dicatat sebagai penguat konteks di samping skor teks, bukan penggantinya.
5.  **Rollup frustrasi** masuk pipeline SQLite Fase 12 sebagai tabel dan halaman **Frustration** sendiri di dashboard: per versi model, laju annoyed / at-assistant / angry + jumlah pesan dasarnya, supaya user bisa membandingkan model dengan data, bukan perasaan.
6.  **Judge LLM opsional (pola OMP persis):** role model `judge` di config mengklasifikasi teks prosa unik yang belum terklasifikasi (dibatasi panjang), **estimasi biaya ditampilkan dan disetujui sebelum jalan**, verdict di-cache berdasarkan hash prosa di tabel `frustration_verdicts` supaya run ulang gratis. Dengan verdict: annoyed = P(level 2) + P(level 3) ≥ 0.5; at-assistant menambah syarat target yang dinamai judge adalah assistant; angry = P(level 3) ≥ 0.5. Baris yang verdict-nya mencakup \<50% pesan ditandai “mostly regex”. Pengeluaran judge dicatat ke sesi berjalan, seperti OMP.
7.  \[diubah\] **Lapis saran (bagian barunya):** saat laju frustrasi sebuah model melewati ambang yang bisa dikonfigurasi relatif terhadap baseline user sendiri (mis. kelipatan dari laju median semua modelnya, hanya bila jumlah pesan minimum terpenuhi), agent menampilkan saran eksplisit di sesi dan di dashboard: model apa yang bermasalah, datanya apa, dan tawaran konkret — pindah model sekarang, atau turunkan posisi model itu di combo aktif (Fase 6). **Saran tidak pernah mengeksekusi sendiri:** pergantian hanya terjadi atas persetujuan user, dan setiap saran + keputusan user dicatat di transkrip. Karena tugas sulit cenderung diberikan ke model kuat, laju frustrasi mentah bias terhadap model kuat; saran hanya muncul bila selisihnya signifikan (uji proporsi sederhana dengan jumlah minimum) dan UI menyebut bias ini apa adanya.

Kriteria selesai

Fixture korpus pesan berlabel (termasuk prompt panjang ≥3 baris yang marah-marah secara sopan dan pesan berisi kode penuh umpatan di dalam string) diklasifikasi sesuai label oleh jalur regex; fixture sesi dengan pergantian model di tengah membuktikan atribusi mengikuti model yang sedang diajak bicara; halaman Frustration menunjukkan laju per versi model dari fixture yang sama; fixture ambang membuktikan saran ganti model muncul dengan datanya dan *tidak* ada pergantian model yang terjadi tanpa persetujuan; run judge kedua atas korpus yang sama berbiaya nol karena cache hash. Fixture korpus Indonesia berlabel diklasifikasi sesuai label.

### Fase 14 · Discord Rich Presence

Status agent tampil lengkap di profil Discord user lewat IPC lokal: yang sedang dikerjakan, modelnya, tokennya, sudah berapa lama — dengan privasi per field dan tanpa satu pun kredensial Discord.

Rilis: v0.6

#### Tugas kecil

1.  \[diubah\] **Spike wajib setengah hari sebelum kode final:** program Bun minimal yang di-compile (`bun build --compile`) menyambung ke `\\.\pipe\discord-ipc-0` *dan* `\\?\pipe\discord-ipc-0` (transport memakai bentuk yang lolos) di Windows asli dengan Discord jalan, handshake, dan menyetel satu activity. Hasilnya menentukan transport final: `node:net` bila lolos, API native `Bun.connect({unix})` bila tidak, atau sidecar skrip kecil yang di-spawn binary utama sebagai jalan terakhir. Catat hasilnya di repo; jangan menulis modul penuh sebelum spike ini hijau.
2.  **Transport IPC hand-rolled** (`src/presence/ipc.ts`, nol dependensi runtime, di belakang interface `Transport` supaya implementasi berbasis library bisa ditukar masuk): penemuan path indeks 0–9 (Windows `\\?\pipe\discord-ipc-{n}`; Linux/macOS prefix `$XDG_RUNTIME_DIR` → `$TMPDIR` → `$TMP` → `$TEMP` → `/tmp`, plus probing subdirektori Flatpak `app/com.discordapp.Discord/` dan Snap `snap.discord/`), framing header 8 byte little-endian + JSON, handshake opcode 0 dengan Application ID saja, perintah `SET_ACTIVITY` opcode 1, decoder frame yang tahan frame tergabung/terpotong dan membatasi ukuran frame. WSL2 terdeteksi dan gagal diam-diam dengan satu baris log debug (pipe Windows tidak terjangkau tanpa relay).
3.  **State dan formatter** (`state.ts`, `format.ts`): `AgentPresenceState` (status, kata kerja tool, basename file, model, token, estimasi biaya, proyek, branch, worker berjalan/maks, waktu mulai sesi) diterjemahkan ke activity oleh satu fungsi murni: `details` = status + aksi sekarang, `state` = proyek · model · token (· biaya bila diizinkan), tooltip gambar besar = model lengkap + nama combo, `timestamps.start` tetap sepanjang sesi. Formatter adalah **satu-satunya titik penyaring privasi** dan menegakkan batas 2–128 karakter (potong dengan …, tidak pernah memancarkan string 1 karakter). State harus bisa diserialisasi ke JSON apa adanya, supaya ekstraksi daemon nanti mekanis.
4.  **Pemetaan tool ke kata kerja manusia** untuk tool inti Fase 2 (pola claude-presence): edit/write → `Editing <basename>`, read → `Reading …`, bash → `Running terminal command` (perintahnya sendiri tidak pernah ditampilkan), grep → `Searching codebase`, glob → `Finding files`, web → `Searching the web`, subagent → `Running subagent`, tool lain → `Using <nama tool>`.
5.  **Mesin status:** `working`, `waiting-for-approval` (dari event `approval.requested` Fase 3; ikon kecil khusus karena ini state yang paling perlu dilihat user), `planning/thinking`, `waiting-for-input` (turn selesai atau 120 detik tanpa event), dan `orchestrating` di mode coordinator Fase 11. Tiap status punya aset ikon kecil sendiri (`status-working`, `status-waiting`, `status-thinking`, `status-idle`) di aplikasi Discord bawaan; gambar besar = logo agent. Perilaku idle dapat dipilih: tampilkan kartu Waiting atau hapus kartu setelah timeout.
6.  **Coalescer update:** dedupe payload yang sama persis, interval minimum **15 detik** ditegakkan sebagai lantai (nilai config lebih kecil diabaikan), flush trailing-edge supaya state terbaru yang terkirim, tidak pernah mengirim saat tidak ada perubahan. Perubahan token/biaya ikut menumpang flush bermakna berikutnya, bukan memicu flush sendiri; perubahan ke `waiting-for-approval` ter-flush pada instans legal paling awal. `timestamps.start` konstan di semua flush.
7.  **Siklus hidup fail-silent:** koneksi malas hanya saat `session.started` (CLI sekali jalan seperti `--help` tidak menyentuh IPC dan tidak menunda exit); seluruh batas modul dibungkus catch-all — Discord tidak ada, pipe hilang, handshake ditolak, Activity Privacy mati di sisi user, semuanya keadaan normal tanpa output konsol dan tanpa lemparan error ke loop. Reconnect dengan backoff 1 → 2 → 5 → 10 → 30 detik (pindai ulang indeks 0–9 tiap percobaan, backoff reset saat sukses, state terakhir dikirim ulang begitu `READY`). Saat exit graceful: kirim `SET_ACTIVITY` kosong lalu tutup pipe; saat crash, penutupan pipe membersihkan kartu dengan sendirinya. Timer dan socket tidak boleh menahan proses tetap hidup (async, unref).
8.  **Config dan kontrol runtime:** blok `presence` di config global dengan override per proyek (dicocokkan dari root repo/remote): `enabled` (juga env `AGENT_PRESENCE=0` dan flag `--no-presence`), `clientId` (null = aplikasi bawaan; mengganti ke app sendiri mengubah nama/art kartu jadi milik user dan key aset upload harus ada di app mereka atau gambar diam-diam fallback), `showProject`, `showBranch` (default mati), `showFileName` (basename saja), `showModel`, `showTokens`, `showCost` (default mati; biaya yang tampil ditandai `~` bila estimasi), `showRepoButton`, `partyMode` (default mati), `idleTimeoutSec` 120, dan daftar proyek yang dinonaktifkan total. Perintah runtime `/presence pause`, `/presence resume`, dan **Incognito satu tombol** (proyek → `Private Project`, branch + nama file + tombol repo hilang, agent dan model tetap tampil; pause dan Incognito persisten seperti di pluginmu). Pola file sensitif (`.env`, `*secret*`, dst) menyembunyikan nama file otomatis.
9.  **Tombol repo:** `buttons[0]` “View Repository” hanya bila remote `origin` adalah URL https publik yang valid; tidak pernah untuk remote SSH-only/pribadi tanpa opt-in, dan selalu hilang di Incognito. Slot tombol kedua dibiarkan kosong. Dokumentasikan di README bahwa tombol tidak terlihat oleh pemilik kartu (perilaku Discord) dan presence hanya butuh Application ID publik — tidak ada client secret atau token apa pun di config.
10. **Agregasi coordinator dan arbitrase:** di mode Fase 11, token/biaya = agregat semua worker, status = worker berprioritas tertinggi (`waiting-for-approval > error > working > planning > idle`), dan jumlah worker tampil sebagai sufiks `+N` di `details`; party mode opt-in merender `party.size = [berjalan, maks]` dengan `privacy: PRIVATE` dan id acak per sesi, tanpa secret. Antar proses agent independen: last-active-wins untuk v1, ditegakkan satu instance provider presence per mesin sebisa mungkin agar kartu tidak flip-flop.
11. **Diagnostik:** perintah `/presence status` melaporkan terhubung atau tidak, indeks pipe yang dipakai, error terakhir, dan kartu terformat yang akan tampil — karena setiap tool peer akhirnya membutuhkan ini untuk kebutuhan support. Aset aplikasi bawaan disiapkan: logo 1024×1024 dan empat ikon status, key lowercase sesuai aturan portal.

Kriteria selesai

Di Windows asli dengan Discord jalan: kartu tampil dengan nama app agent, `details`/`state` mengikuti status sesi secara langsung (working, waiting approval, waiting input), timer elapsed tidak ke-reset antar update, dan tidak lebih dari satu update terkirim per 15 detik pada fixture event yang rapat (dilihat dari log debug). Discord ditutup di tengah sesi → agent tetap jalan tanpa error yang terlihat, dan presence pulih sendiri saat Discord dibuka lagi. Incognito terbukti menyembunyikan proyek/branch/file/tombol repo pada kartu terformat; fixture remote SSH-only membuktikan tombol repo tidak dibuat; fixture perintah bash berisi string mirip token membuktikan hanya kata kerja generik yang tampil. Spike binary Bun Windows (tugas 1) terdokumentasi hasilnya di repo.

### Fase 15 · Appearance: tema, status line dua lapis, dan budget performa

Agent terasa selesai dan tetap ringan: tema ala Pi yang dipangkas (bukan 66 token OMP), status line segmen ala OMP plus hook perintah eksternal ala Claude Code (yang tidak dimiliki OMP, Pi, maupun OpenCode), dan target performa final di atas gerbang regresi yang sudah aktif sejak Fase 0 — dibangun di atas TUI Fase 9 (renderer ADR-003), yang layout dasarnya tetap (transkrip, composer, status line).

Rilis: v0.7

#### Tugas kecil

1.  **Skema tema satu file JSON per tema** (format Pi): `{ "name", "vars": {...}, "colors": {...}, "export": {...} }` dengan `export` opsional untuk ekspor HTML Fase 5; nilai warna `#RRGGBB` \| indeks `0–255` \| nama var (boleh bersarang; referensi hilang/melingkar = error yang dilaporkan) \| `""` (default terminal); hex dipancarkan sebagai truecolor di terminal yang mampu, dikonversi ke 256 warna terdekat bila tidak. Validasi memakai skema JSON yang dikirim di repo, tapi **token yang hilang diisi dari tema dasar dan kunci tak dikenal hanya diperingatkan** — satu kunci asing tidak pernah menenggelamkan seluruh file seperti perilaku `additionalProperties: false` OMP.
2.  **Set token v1: ±38** (dipotong dari 66-nya OMP dan 51-nya Pi). Core 11 Pi dipertahankan (`accent`, `border`, `borderAccent`, `borderMuted`, `success`, `error`, `warning`, `muted`, `dim`, `text`, `thinkingText`); latar & teks pesan/tool memakai grup Pi (`selectedBg`, `userMessageBg`/`userMessageText`, `customMessageBg`/`customMessageText`/`customMessageLabel`, `toolPendingBg`/`toolSuccessBg`/`toolErrorBg`, `toolTitle`, `toolOutput`); markdown dipangkas ke 6 (`mdHeading`, `mdLink`, `mdCode`, `mdCodeBlockBorder`, `mdQuoteBorder`, `mdListBullet`; `mdLinkUrl`/`mdCodeBlock`/`mdQuote`/`mdHr` default ke `muted`/`text`/`border` di kode); diff 3 utuh; syntax 9 utuh (highlighting terlihat rusak dengan lebih sedikit); **status line 5 terkonsolidasi** (`statusLineBg`, `statusLineModel`, `statusLinePath`, `statusLineGitClean`, `statusLineGitDirty`) dengan konteks/biaya/subagent memakai ulang token inti, bukan 13 token terpisah ala OMP; mode 2 (`bashMode` + satu `thinkingAccent`; level thinking tetap terkode di border editor seperti Pi/OMP, dipetakan dari satu token itu, bukan 7 warna per level).
3.  **Tema bawaan yang dikirim: 5 + `system`** — `dark` (palet rumah), `light`, pasangan Catppuccin (Mocha untuk slot gelap, Latte untuk slot terang), Tokyo Night, dan Gruvbox atau Nord; tema `system` kebanyakan berisi `""` (mengikuti warna terminal) dan adalah tema paling tangguh di terminal aneh. Bukan 98–100 tema ala OMP: itu konsekuensi fork matang berkontributor, dan file user menutup sisanya.
4.  **Slot terang/gelap model OMP:** config `theme: { dark: <nama>, light: <nama> }`; deteksi latar terminal lewat kueri **OSC 11** dengan fallback `COLORFGBG`, default ke slot gelap bila tidak ada sinyal, dan **dievaluasi ulang saat penampilan terminal/OS berubah selagi TUI jalan** sehingga slot bertukar langsung. Setting global `symbolPreset: unicode | nerd | ascii` (dicuri dari OMP) berlaku lintas tema, bukan per tema, di v1.
5.  **Lokasi dan penemuan tema:** bawaan tertanam di binary; file user di `~/.<agent>/agent/themes/*.json`; **tema proyek di `.<agent>/themes/*.json` didukung untuk proyek tepercaya saja** (meniru Pi; OMP yang mengabaikan tema proyek adalah yang menyimpang). Nama file tanpa `.json` = nama pilihan = field `name` di JSON; tabrakan nama dengan bawaan diselesaikan eksplisit (bawaan menang, seperti OMP, dan didokumentasikan).
6.  **Perintah `/theme` dengan pratinjau langsung** (UX /settings OMP, apapun nama perintahnya): menggerakkan pilihan me-render ulang TUI dengan tema kandidat, Enter mempertahankan dan menyimpan ke config, Esc memulihkan tema sebelumnya. File kustom yang sedang aktif **di-hot-reload**: simpan JSON valid me-repaint TUI setelah debounce ±100 ms tanpa perintah reload; simpan yang rusak mempertahankan versi baik terakhir di layar dan melaporkan error-nya, tidak pernah layar kosong.
7.  **Status line lapis 1 — segmen bawaan:** satu baris powerline, kiri/kanan terpisah, layout default: kiri `model` (nama tampil + level thinking, warna `statusLineModel`), `mode` (Plan/Fast/mode persetujuan, hanya tampil saat bukan default), `path` (cwd dipendekkan `~`, relatif-repo di dalam repo git), `git` (branch + `+staged ~unstaged ?untracked`, warna clean/dirty); kanan `context_pct` (`54%/200k` + bar kecil; kuning ≥70%, merah ≥90%; penanda compaction setelah compact), `tokens` (`↑in ↓out`, opsi `R` cache-read dan `CH` hit%), `cost` (estimasi harga daftar sesi, dilabeli estimasi), `budget`, `session` (nama/id pendek), `status` (`● working / ○ waiting / ✓ ready / ✗ error` + slot status modul internal + hitungan subagent). Config meniru idiom OMP: `statusLine.preset` (`default | minimal | compact | full | custom`; `minimal` = model+path+git+context_pct, `compact` = default tanpa tokens/session, `full` = semuanya termasuk cache + tok/s + jam), `separator` (`powerline-thin` default \| `powerline | slash | pipe | block | none | ascii`), `transparent`, dan `leftSegments`/`rightSegments`/`segmentOptions` yang hanya dibaca saat `preset: custom`. **Aturan terminal sempit (meniru OMP):** segmen dibuang dalam urutan prioritas tetap (jam → tokens → session → path dipotong dari kiri → mode), tidak pernah membungkus baris atau overflow — baris yang overflow merusak renderer diferensial.
8.  \[diubah\] **Segmen `budget` — segmen khas agent ini:** sisa budget dari Fase 6 (`$4.92 left`, `1.2M tok left`, atau % cap tersisa — unitnya mengikuti budget Fase 6, jadi model langganan tanpa harga tetap punya segmen yang bermakna; berubah merah di bawah 10%). Tidak ada agent yang disurvei yang mengirimkannya sebagai segmen kelas satu (Pi/OMP menampilkan belanja, bukan sisa; spend limit Claude Code ada di payload tapi di balik gateway) — ini pembeda kecil yang terlihat setiap saat. Segmen `git` **di-cache**: refresh di batas turn dan setelah tool pengubah file, TTL 1–5 detik; tidak pernah spawn `git` per render (persis biaya yang diperingatkan dokumen Claude Code).
9.  **Status line lapis 2 — hook perintah eksternal (kontrak Claude Code, diperbaiki):** config `statusLine: { type: "command", command: "~/.<agent>/statusline.sh", refreshInterval: 5, timeoutMs: 2000, padding: 0 }`; bila disetel, output-nya **menggantikan baris lapis 1** (model mental lebih sederhana daripada baris ekstra di atas badge ala Claude Code). **stdin JSON menyalin nama field Claude Code** di mana tumpang tindih (`model.id`/`display_name`, `effort`/`thinking`, `cwd`/`workspace`, `cost.*`, `context_window.*`, `rate_limits.*`, `session_id`/`session_name`/`transcript_path`, `version`) **plus dua perbaikan atas gap-nya**: blok `git` berisi `branch` + hitungan staged/unstaged/untracked (skrip tidak perlu shell-out ke git) dan blok `budget` (`session_remaining_tokens`, `session_remaining_turns`, `session_cap_usd`, `session_remaining_usd`, `daily_remaining_usd`), ditambah `agent_status`. **Semantik refresh persis Claude Code:** jalan saat mulai, pesan assistant baru, compaction selesai, mode/model berubah, dan tiap `refreshInterval` (detik, min 1); **debounce 300 ms; run yang sedang jalan dibatalkan/dibunuh saat trigger baru tiba; `timeoutMs` ditegakkan** (skrip menggantung tidak pernah membekukan footer); env `COLUMNS`/`LINES` disetel karena stdout ditangkap; stdout ANSI + multi-baris dihormati, dibatasi maks 3 baris; error/exit non-nol jatuh kembali ke lapis 1, bukan baris kosong.
10. \[diubah\] **API UI internal** (pola Pi/OMP) untuk modul milik sendiri — presence, budget, orchestration: `setStatus(key, text | undefined)` menulis slot bernama yang dirender segmen `status`, dan `setWidget(key, lines, "aboveEditor" | "belowEditor")`. Ini bukan API ekstensi pihak ketiga: sistem ekstensi belum ada di plan dan masuk backlog, dan `setFooter` ditunda bersamanya.
11. \[diubah\] **Rendering yang menjaga latensi:** renderer diferensial (`render(width): string[]`, diff baris, CSI 2026) sudah berdiri sejak Fase 9 sesuai ADR-003, jadi fase ini tidak mengganti renderer. Yang ditambahkan: ganti tema, hot reload, dan refresh status line tidak pernah memicu redraw penuh; `requestRender()` dikoales per tick; siklus blok transkrip aktif → settled → **committed** (ditulis ke scrollback terminal, cache dibebaskan) diaudit di bawah sesi panjang; delta token streaming tetap ≤30 paint/detik.
12. \[diubah\] **Target performa final:** gerbang regresi sudah aktif sejak Fase 0 (ADR-006) dan latensi TUI sejak Fase 9; fase ini menetapkan target absolut dan menutup sisanya. Flag `--startup-trace` mencatat mark `performance.now()` (config dimuat / tema dimuat / render pertama / siap) dan waktu sampai byte pertama ke provider untuk headless. Target: **cold start \<300 ms p50** (stretch \<150 ms), **overhead headless \<500 ms** di luar TTFT, **idle RSS \<100 MB** (stretch \<70 MB), pertumbuhan RSS \<20 MB per 1.000 pesan (state sesi berjendela; file sesi \>8 MiB di-stream), perintah status line eksternal ≤200 ms tipikal, dan **ukuran binary di bawah target yang ditetapkan dari baseline Fase 0**, dengan anggaran per dependensi dicatat tiap rilis. Disiplin penjaganya: antrean terbatas, sink output tool head+tail, periferal malas (MCP di-race 250 ms dan ditunda, provider di-lazy-import, preconnect saat penyiapan sesi). Diukur di Windows dan Linux.

Kriteria selesai

Fixture tema kustom dengan satu token hilang dan satu kunci asing tetap termuat (token diisi dari tema dasar, kunci asing diperingatkan, TUI tidak jatuh ke fallback); `/theme` membuktikan pratinjau langsung + Esc memulihkan, dan menyimpan file tema aktif membuktikan hot reload tanpa restart; pergantian penampilan terminal membuktikan slot dark/light bertukar selagi TUI jalan; tema proyek hanya termuat di proyek tepercaya. Status line: preset `custom` membuktikan urutan `leftSegments`/`rightSegments` yang dikonfigurasi ter-render persis, terminal sempit membuktikan segmen dibuang mengikuti urutan prioritas tanpa overflow, dan segmen `budget` berubah mengikuti pemakaian Fase 6. Hook eksternal: skrip fixture menerima JSON berisi `git.branch` dan blok `budget`, skrip yang tidur 5 detik terbukti dibunuh di `timeoutMs` dengan footer jatuh ke lapis 1, dan trigger rapat terbukti ter-debounce 300 ms dengan run lama terbatalkan. Budget: `--startup-trace` pada mesin uji mencatat cold start \<300 ms dan idle RSS \<100 MB, ukuran binary di bawah target dari baseline Fase 0, dan gerbang regresi CI tetap hijau; semua uji jalan di Windows dan Linux.

## E Hasil akhir: vonis dan daftar pembeda final

Enam riset (anatomi agent + 9Router, Antigravity, orchestration, riset penutup soal `/stats`/frustrasi/combo, riset Discord RPC, dan riset appearance/status line/profil ringan Oh My Pi dan Pi) menyatu jadi satu cetak biru: agent ini realistis dibangun satu orang karena semua polanya sudah terbedah, dan pembedanya menutup celah yang belum terisi secara terintegrasi di pasaran. Klaim “tidak ada” dicek ulang sebelum dipakai di README.

### Daftar pendek pembeda final (yang dibangun, berurutan)

1.  \[diubah\] **Hard budget + combo fallback bernama di dalam sesi** (Fase 6) — rantai fallback di file config sudah ada di OMP (`retry.fallbackChains`) dan LiteLLM, dan Claude Code headless punya batas giliran dan biaya per run. Yang dibangun di sini adalah gabungannya di satu agent: combo sebagai model virtual yang sah di mana pun model sah, normalisasi transkrip saat pindah model, dan budget berbasis token/giliran yang juga berlaku untuk model langganan.
2.  \[diubah\] **Verification gate bawaan, dijalankan runner, tahan bypass** (Fase 7) — Stop hook Claude Code bisa dipakai merakit gate serupa secara DIY; di sini gate adalah bagian inti, dijalankan runner (bukan model), dan file terlindungi dicek lewat hash sehingga tidak bisa diakali lewat bash.
3.  \[diubah\] **Sesi JSONL portabel dengan skema publik dan redaksi secret** (Fase 5) — agent lain juga menyimpan sesi lokal, jadi ini kualitas dasar, bukan pembeda besar; nilainya ada di skema terdokumentasi, export/import/replay, dan tanpa server vendor.
4.  **Saran ganti model berbasis frustrasi per model** (Fase 13) — OMP mengukur frustrasi tapi tidak menindaklanjutinya; tidak ditemukan agent yang menindaklanjutinya. Dengan leksikon Indonesia sejak v1, inilah pembeda yang paling belum diklaim.
5.  **Panel RAM proses + mesin di dashboard `/stats`** (Fase 12) — statistik resource proses tidak ada di omp-stats maupun agent lain yang disurvei; sisanya dari dashboard itu meniru pola OMP yang terbukti.
6.  **Discord Rich Presence lengkap khas agent** (Fase 14) — bukan pembeda celah pasar, tapi fitur yang polanya sudah terbukti (termasuk dari `orca-discord-rpc` milikmu): status termasuk waiting-for-approval, model, token, dan timer sesi, hand-rolled tanpa dependensi, dengan privasi per field sejak awal.
7.  \[diubah\] **Appearance kelas satu + status line dua lapis + ringan yang terukur** (Fase 15) — tema ala Pi yang dipangkas (±38 token, 5 bawaan + file user/proyek, hot reload, slot dark/light), status line segmen ala OMP plus hook perintah eksternal ala Claude Code dengan payload yang diperbaiki (`git.branch` dan budget ikut), segmen sisa budget, dan gerbang performa yang aktif sejak Fase 0.

Yang sengaja *bukan* pembeda: login Antigravity native (dilarang tertulis oleh Google, sudah ada gelombang ban — masuk lewat 9Router), merge otomatis di orchestration (tidak ada pemain pasar yang membuktikan aman; integrasi tetap terpicu manusia di Fase 11), strategi combo Smart Router/Fusion (ada di 9Router, tapi biayanya judge per request; ditunda di backlog), dan memory lintas proyek (masih di backlog F, belum di 16 fase).

## F Ditunda: backlog eksplisit, bukan lupa

Item di sini sengaja tidak masuk 16 fase di atas. Dicatat supaya tidak ada yang menganggapnya hilang, dan tidak ada yang menyelundupkannya ke tengah jalan.

- **ACP client untuk binary resmi `antigravity-acp`**: satu-satunya rute Antigravity native yang patuh ToS; model hanya Gemini. Rute yang didukung sekarang adalah 9Router (Fase 1) dan API key resmi.
- **Memory lintas proyek** yang bisa diinspeksi user dan disuntik ulang setelah compaction (celah pasar nomor 3; setelah Fase 4 dan 5 stabil).
- \[baru\] **Klien LSP** (diagnostik semantik + navigasi): v1 memakai perintah diagnostik per proyek pasca-giliran (Fase 2); LSP menyusul bila eval menunjukkan manfaat yang sepadan dengan biaya startup dan RAM.
- \[baru\] **Sistem ekstensi pihak ketiga** (API `ctx.ui` publik, `setFooter`, tool dan perintah dari paket): API UI internal Fase 15 adalah benihnya.
- \[baru\] **Tool PowerShell native di Windows**: ADR-004 memakai Git Bash untuk v1.
- \[baru\] **Kompatibilitas Node sebagai runtime kedua**: dicabut oleh ADR-001; dibuka lagi hanya bila distribusi via npm tanpa Bun benar-benar dibutuhkan.
- **Permukaan review terurut risiko** + batas perubahan per tugas (celah pasar nomor 10).
- **Workflow script dinamis** ala Claude Code dan agent teams peer-to-peer (setelah Fase 11 terbukti; titik manis paralel hanya 3 sampai 5 writer).
- **Merge queue otomatis** (hanya Gas Town yang punya; risiko tinggi).
- **OS-level sandbox sendiri** (pakai permission + mode dulu).
- **Strategi combo Smart Router dan Fusion ala 9Router** (judge memilih model di depan, atau semua model paralel + sintesis judge): biaya judge per request; strategi `fallback` dan `round-robin` Fase 6 harus terbukti dulu.
- **Demosi otomatis model di combo berdasar frustrasi**: Fase 13 berhenti di saran yang butuh persetujuan user. Mengubah urutan combo tanpa persetujuan adalah langkah terpisah yang hanya boleh dipertimbangkan setelah data saran terbukti akurat.
- **Statistik host mendalam**: penjumlahan pohon proses (RSS termasuk LSP/shell/subagent), disk I/O, suhu, GPU — butuh helper native atau pustaka `systeminformation` yang di Windows lambat (shell-out PowerShell). Panel Resource Fase 12 memakai builtin dulu dan menyatakan batasnya dengan jujur.
- **Kemewahan appearance v2 (di atas Fase 15)**: override simbol per tema + spinner frames kustom ala OMP, ±100 tema bawaan dan marketplace/paket tema, HUD subagent di footer, renderer ekstensi in-process penuh di luar `setStatus`/`setWidget`, serta LSP/DAP — semuanya ditunda karena biaya beratnya terukur di riset A4 (itulah yang membuat OMP sampai di ±183 MB); v1 appearance berhenti di ±38 token, 5 bawaan + `system`, dan dua lapis status line.
- **Discord RPC lanjutan (di atas Fase 14)**: dial level detail ala “Cycle Detail Level”-nya plugin jondmarien dan template string `details`/`state` yang bisa diedit user (variabel `{status} {tool} {model} {tokens} {cost} {project} {branch} {elapsed} {workers}`, pola VSCord); tampilkan biaya + persen konteks di tooltip di balik `showCost`; art per mode/model dan art animasi via URL eksternal; agregasi multi-proses (lockfile leader, lalu ekstraksi daemon ala opencode-rich-presence bila memang dibutuhkan); dukungan relay WSL2 ke Discord Windows; wizard client ID kustom dengan validasi key aset di app milik user.

Ditolak permanen

**Login Antigravity / OAuth consumer native untuk didistribusikan.** Melanggar ToS Google dan sudah ada gelombang ban Februari 2026. Agent ini tidak akan pernah mengimplementasikannya; kuota Antigravity masuk lewat 9Router, bukan lewat token yang diutak-atik sendiri.

## G Handoff ke Claude Code

\[diubah\] Eksekusi memakai paket starter yang menyertai revisi ini: `CLAUDE.md` (aturan tetap), `docs/WORKFLOW.md` (git, issue, PR), template issue/PR, perintah garis miring di `.claude/commands/`, dan skrip sinkron issue. Spesifikasi hidup di repo; status kerja hidup di GitHub Issues. File MD per fase ditulis tepat sebelum fasenya dimulai, berdasarkan kode yang sudah ada — bukan 16 file berisi kode lengkap yang ditulis di muka lalu basi.

LANGKAH 1 · PER FASE, TEPAT WAKTU

**`/fase-rencana NN`**: Claude Code membaca bagian fase ini, ADR, dan kode yang ada, lalu menulis `docs/phases/fase-NN.md` (Goal, Architecture, Tech Stack, task berkode `FNN-TMM` dengan Files, langkah, perintah verifikasi + output yang diharapkan) dan membuka PR docs. Setelah kamu merge, **`/sinkron-issue NN`** membuat satu issue per task di milestone fase itu.

LANGKAH 2 · PER ISSUE

**`/kerjakan`**: ambil issue terbuka berikutnya di milestone aktif, branch `fNN/tMM-slug` dari `main` terbaru, commit kecil, verifikasi lokal, lalu PR berisi `Closes #N`. CI Linux + Windows harus hijau. **Kamu yang review dan squash-merge**; Claude Code tidak pernah merge sendiri dan tidak lanjut ke issue berikutnya tanpa diminta.

LANGKAH 3 · GERBANG FASE DAN RILIS

**`/gerbang-fase NN`**: semua issue milestone tertutup, kriteria selesai dijalankan dan dibuktikan, eval dijalankan bila fase menyentuh prompt/tool/loop, laporan masuk lewat PR docs. Kamu menutup milestone; di batas peta B (setelah Fase 3, 7, 10, 11, 13, 14, 15) kamu membuat tag `v0.N.0`.

### Aturan main buat sesi eksekusi

- **Satu issue = satu branch = satu PR = satu squash commit di `main`.** Tidak ada kerja langsung di `main`, tidak ada force push ke `main`, tidak ada merge commit.
- `main` dilindungi: wajib lewat PR, CI hijau di Linux dan Windows (termasuk job perf), riwayat linear.
- Commit memakai Conventional Commits dengan scope fase (`feat(f06): …`) dan baris `Refs #N`; judul PR `feat(f06): ringkasan [F06-T03]`.
- Sebelum mulai fase baru, buktikan kriteria selesai fase sebelumnya masih hijau.
- Kalau spec di file MD salah atau tidak jalan: berhenti, komentar di issue dengan label `status:needs-decision`, dan perbaiki spec lewat PR docs. Jangan improvisasi desain di PR kode.
- Prinsip C mengikat di semua fase, terutama: Windows diuji tiap PR, test yang ada tidak pernah dilemahkan agar lulus, headless stdout tetap bersih, dan dependensi runtime baru butuh persetujuan tertulis.

Plan final coding agent · Sintesis enam riset 7–8 Nov 2026: arsitektur agent + 9Router, Antigravity, orchestration, Oh My Pi `/stats` + frustrasi + combo fallback, Discord Rich Presence, dan appearance + status line + profil ringan Oh My Pi dan Pi · Gaya plan: Superpowers writing-plans (bite-sized tasks, verifikasi per tugas, tanpa placeholder) · Revisi 8 Nov 2026: enam ADR dikunci, kontradiksi diperbaiki, alur kerja GitHub Issues + PR.

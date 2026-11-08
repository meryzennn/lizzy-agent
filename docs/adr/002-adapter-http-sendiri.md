# ADR-002: Adapter HTTP sendiri, tanpa AI SDK

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Format pesan kanonik internal sudah milik proyek ini. Memakai Vercel AI SDK berarti konversi kanonik → format AI SDK → wire, dengan risiko thinking signature dan field khusus provider hilang, plus bobot startup tambahan.

## Keputusan

Dua adapter ditulis sendiri dengan `fetch` + parser SSE: OpenAI Chat Completions (dan kompatibelnya, termasuk 9Router) serta Anthropic Messages. Tidak ada `ai`, `@ai-sdk/*`, atau SDK provider di dependencies.

## Konsekuensi

Lebih banyak kode yang dirawat (streaming tool call delta, usage, error mapping), tapi kontrol penuh atas transkrip dan startup lebih ringan. Test transformasi per kasus wajib.

## Ditinjau ulang bila

Muncul protokol ketiga yang wajib didukung (mis. OpenAI Responses API) dan biaya menulisnya sendiri jelas lebih besar.

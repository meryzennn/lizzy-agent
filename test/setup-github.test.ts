import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveShell } from "../src/platform/shell";

const directories: string[] = [];
afterEach(() => {
  for (const root of directories.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function provision(ids = "", failure = "") {
  const root = mkdtempSync(join(tmpdir(), "lizzy-ruleset-test-"));
  directories.push(root);
  const harness = join(root, "stub.sh");
  writeFileSync(
    harness,
    `
    gh() {
      case "$1 $2" in
        "auth status"|"label create"|"repo edit") return 0 ;;
        "repo view") echo owner/repo; return 0 ;;
      esac
      if [[ "$1" == api && "$2" == *milestones* ]]; then
        for n in $(seq -w 0 15); do echo "F$n existing"; done
        return 0
      fi
      if [[ "$1" == api && "$2" == *rulesets* ]]; then
        [[ "$STUB_FAILURE" == read ]] && { echo 'ruleset lookup failed' >&2; return 7; }
        printf '%s' "$STUB_IDS"
        return 0
      fi
      if [[ "$1 $2" == "api -X" ]]; then
        printf '%s\\n' "$3 $4" >> "$STUB_ROOT/mutations"
        cat > "$STUB_ROOT/payload.json"
        [[ "$STUB_FAILURE" == write ]] && { echo 'ruleset update failed' >&2; return 8; }
        echo 26794111 > "$STUB_ROOT/created"
        return 0
      fi
      echo "Unexpected gh call: $*" >&2
      return 9
    }
    source "$SETUP_SCRIPT"
  `,
  );
  const result = spawnSync(resolveShell(), ["--noprofile", "--norc", harness], {
    cwd: root,
    env: {
      ...process.env,
      STUB_IDS: ids,
      STUB_FAILURE: failure,
      STUB_ROOT: root.replaceAll("\\", "/"),
      SETUP_SCRIPT: resolve("scripts/setup-github.sh").replaceAll("\\", "/"),
    },
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  return { result, root };
}

test.each(["", "26794111"])(
  "protection uses ruleset create/update (existing=%s)",
  (ids) => {
    const { result, root } = provision(ids);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(join(root, "mutations"), "utf8")).toBe(
      ids
        ? "PUT repos/owner/repo/rulesets/26794111\n"
        : "POST repos/owner/repo/rulesets\n",
    );
    const payload = JSON.parse(
      readFileSync(join(root, "payload.json"), "utf8"),
    );
    expect(payload).toMatchObject({
      name: "Protect main",
      target: "branch",
      enforcement: "active",
      bypass_actors: [],
      conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    });
    expect(
      payload.rules.map((rule: { type: string }) => rule.type).sort(),
    ).toEqual([
      "deletion",
      "non_fast_forward",
      "pull_request",
      "required_linear_history",
      "required_status_checks",
    ]);
    expect(
      payload.rules.find(
        (rule: { type: string }) => rule.type === "pull_request",
      ).parameters,
    ).toEqual({
      required_approving_review_count: 0,
      dismiss_stale_reviews_on_push: true,
      required_reviewers: [],
      require_code_owner_review: false,
      require_last_push_approval: false,
      required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: false,
      allowed_merge_methods: ["squash"],
    });
    expect(
      payload.rules.find(
        (rule: { type: string }) => rule.type === "required_status_checks",
      ).parameters,
    ).toEqual({
      strict_required_status_checks_policy: true,
      do_not_enforce_on_create: false,
      required_status_checks: [
        "check (ubuntu-latest)",
        "check (windows-latest)",
        "measure (ubuntu-latest)",
        "measure (windows-latest)",
        "measure (macos-latest)",
        "perf (ubuntu-latest)",
        "perf (windows-latest)",
      ].map((context) => ({ context, integration_id: 15368 })),
    });
  },
);

test.each(["read", "write"])(
  "ruleset %s failure exits without claiming setup finished",
  (failure) => {
    const { result } = provision("26794111", failure);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("failed");
    expect(result.stdout).not.toContain("Selesai.");
  },
);

test("ambiguous ruleset lookup fails without creating or updating protection", () => {
  const { result, root } = provision("26794111\n26794112");
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Protect main");
  expect(() => readFileSync(join(root, "mutations"))).toThrow();
});

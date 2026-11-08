import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeConfig, parseConfig } from "../src/config";
import { loadConfig } from "../src/platform/config";

test("empty layers receive defaults only after merging", () => {
  expect(parseConfig("{}", "config.jsonc")).toEqual({});
  expect(mergeConfig({}, {})).toEqual({ version: 1, shell: {} });
});

test("JSONC accepts BOM, CRLF, comments and trailing commas", () => {
  expect(
    parseConfig(
      '\ufeff{\r\n// shell\r\n"version":1,\r\n/* path */ "shell":{"bash":"C:\\\\Git\\\\bin\\\\bash.exe",},\r\n}',
      "config.jsonc",
    ),
  ).toEqual({ version: 1, shell: { bash: "C:\\Git\\bin\\bash.exe" } });
});

test("comment-like text inside strings stays intact", () => {
  expect(
    parseConfig('{"shell":{"bash":"https://example.test/*bash*/"}}', "config"),
  ).toEqual({ shell: { bash: "https://example.test/*bash*/" } });
});

test.each([
  { source: '{"version":2}', field: "version" },
  { source: '{"version":"1"}', field: "version" },
  { source: '{"version":null}', field: "version" },
  { source: '{"shell":42}', field: "shell" },
  { source: '{"shell":null}', field: "shell" },
  { source: '{"shell":[]}', field: "shell" },
  { source: '{"shell":{"bash":42}}', field: "shell.bash" },
  { source: '{"shell":{"bash":null}}', field: "shell.bash" },
  { source: '{"shell":{"bash":""}}', field: "shell.bash" },
  { source: '{"unknown":true}', field: "root" },
  { source: '{"shell":{"unknown":true}}', field: "shell" },
  { source: "[]", field: "root" },
  { source: "null", field: "root" },
])("invalid schema $source identifies $field", ({ source, field }) => {
  expect(() => parseConfig(source, "config.jsonc")).toThrow("config.jsonc");
  expect(() => parseConfig(source, "config.jsonc")).toThrow(field);
});

test.each([
  '{"shell":{"bash":"FAKE_SECRET_NEVER_REAL"},',
  '{"version":"FAKE_SECRET_NEVER_REAL"}',
  '{"shell":{"bash":{"token":"FAKE_SECRET_NEVER_REAL"}}}',
  '{"FAKE_SECRET_NEVER_REAL":"FAKE_SECRET_NEVER_REAL"}',
  '{"shell":{"FAKE_SECRET_NEVER_REAL":"FAKE_SECRET_NEVER_REAL"}}',
])("invalid config never exposes source or values: %s", (source) => {
  let error: unknown;
  try {
    parseConfig(source, "config.jsonc");
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toContain("config.jsonc");
  expect(String(error)).not.toContain("FAKE_SECRET_NEVER_REAL");
  expect(String(error)).not.toContain(source);
});

test.each(["", "{", '{"version":1 "shell":{}}', "{version:1}"])(
  "malformed JSONC is actionable: %j",
  (source) => {
    expect(() => parseConfig(source, "config.jsonc")).toThrow("JSONC");
    expect(() => parseConfig(source, "config.jsonc")).toThrow("config.jsonc");
  },
);

test("project fields win and empty project objects retain global fields", () => {
  const global = parseConfig(
    '{"version":1,"shell":{"bash":"global-bash"}}',
    "global",
  );
  for (const source of ["{}", '{"version":1}', '{"shell":{}}']) {
    expect(mergeConfig(global, parseConfig(source, "project"))).toEqual({
      version: 1,
      shell: { bash: "global-bash" },
    });
  }
  expect(
    mergeConfig(
      global,
      parseConfig('{"shell":{"bash":"project-bash"}}', "project"),
    ),
  ).toEqual({ version: 1, shell: { bash: "project-bash" } });
  expect(global).toEqual({ version: 1, shell: { bash: "global-bash" } });
});

test("filesystem layers are isolated, missing is valid, and ancestors are ignored", async () => {
  const root = await mkdtemp(join(tmpdir(), "lizzy-config-"));
  const home = join(root, "home");
  const cwd = join(root, "project");
  const globalPath = join(home, ".lizzy", "config.jsonc");
  const projectPath = join(cwd, ".lizzy", "config.jsonc");
  try {
    await mkdir(home);
    await mkdir(cwd);
    expect(await loadConfig(cwd, home)).toEqual({ version: 1, shell: {} });
    await mkdir(join(home, ".lizzy"));
    await mkdir(join(cwd, ".lizzy"));
    await writeFile(globalPath, '{"shell":{"bash":"global-bash"}}');
    expect(await loadConfig(cwd, home)).toEqual({
      version: 1,
      shell: { bash: "global-bash" },
    });
    await writeFile(projectPath, "{}");
    expect((await loadConfig(cwd, home)).shell.bash).toBe("global-bash");
    await writeFile(projectPath, '{"shell":{"bash":"project-bash"}}');
    expect((await loadConfig(cwd, home)).shell.bash).toBe("project-bash");
    const child = join(cwd, "child");
    await mkdir(child);
    expect((await loadConfig(child, home)).shell.bash).toBe("global-bash");
    await rm(globalPath);
    expect((await loadConfig(cwd, home)).shell.bash).toBe("project-bash");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["home", "project"])(
  "present malformed %s configuration fails without secrets",
  async (location) => {
    const root = await mkdtemp(join(tmpdir(), "lizzy-config-"));
    const path = join(root, location, ".lizzy", "config.jsonc");
    try {
      await mkdir(join(root, location, ".lizzy"), { recursive: true });
      await writeFile(path, '{"secret":"FAKE_SECRET_NEVER_REAL",');
      const result = loadConfig(join(root, "project"), join(root, "home"));
      await expect(result).rejects.toThrow(path);
      await expect(result).rejects.toThrow("JSONC");
      await expect(result).rejects.not.toThrow("FAKE_SECRET_NEVER_REAL");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test.each(["directory", "parent-file"])(
  "%s is a real read failure rather than a missing configuration",
  async (kind) => {
    const root = await mkdtemp(join(tmpdir(), "lizzy-config-"));
    const path = join(root, ".lizzy", "config.jsonc");
    try {
      if (kind === "directory") await mkdir(path, { recursive: true });
      else await writeFile(join(root, ".lizzy"), "FAKE_SECRET_NEVER_REAL");
      const result = loadConfig(root, join(root, "home"));
      await expect(result).rejects.toThrow(path);
      await expect(result).rejects.toThrow("read");
      await expect(result).rejects.not.toThrow("FAKE_SECRET_NEVER_REAL");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

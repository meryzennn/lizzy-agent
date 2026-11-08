import { z } from "zod";

const layer = z.strictObject({
  version: z.literal(1).optional(),
  shell: z.strictObject({ bash: z.string().min(1).optional() }).optional(),
});

export type ConfigLayer = z.infer<typeof layer>;
export type Config = { version: 1; shell: { bash?: string } };

export function parseConfig(text: string, label: string): ConfigLayer {
  let value: unknown;
  try {
    value = Bun.JSONC.parse(text.replace(/^\ufeff/, ""));
  } catch {
    throw new Error(
      `${label}: invalid JSONC; check quotes, commas and brackets.`,
    );
  }
  const parsed = layer.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${label}: field ${issue.path.join(".") || "root"} is invalid (${issue.code}); use version 1 and shell.bash as a nonempty string, and remove unknown fields.`,
    );
  }
  return parsed.data;
}

export function mergeConfig(global: ConfigLayer, project: ConfigLayer): Config {
  return {
    version: project.version ?? global.version ?? 1,
    shell: { ...global.shell, ...project.shell },
  };
}

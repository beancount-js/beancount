import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type StoryIndexEntry = {
  id: string;
  type?: string;
  title?: string;
  tags?: string[];
};

type Options = {
  approved: boolean;
  allowDirty: boolean;
  createOnly: boolean;
  interaction: boolean;
  storyId?: string;
  component?: string;
};

const FAVA_REFERENCE_TAG = "fava-reference-visual";

function parseArgs(argv: string[]): Options {
  const options: Options = {
    approved: false,
    allowDirty: false,
    createOnly: false,
    interaction: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--approved") options.approved = true;
    else if (argument === "--allow-dirty") options.allowDirty = true;
    else if (argument === "--create-only") options.createOnly = true;
    else if (argument === "--interaction") options.interaction = true;
    else if (argument === "--story-id") options.storyId = argv[++index];
    else if (argument === "--component") options.component = argv[++index];
    else if (argument === "--step-id" || argument === "--step-label")
      index += 1;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd: resolve("."),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status ?? 1}`,
    );
  }
}

function loadStories(): StoryIndexEntry[] {
  const indexPath = resolve("storybook-static/index.json");
  if (!existsSync(indexPath)) {
    throw new Error("storybook-static/index.json was not produced");
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
    entries?: Record<string, StoryIndexEntry>;
  };
  return Object.values(index.entries ?? {}).filter(
    (entry) => entry.type === "story",
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (
    !options.approved ||
    process.env.VISUAL_UPDATE_APPROVED !== "1" ||
    (!options.storyId && !options.component)
  ) {
    throw new Error(
      "Baseline writes require VISUAL_UPDATE_APPROVED=1, --approved, and --story-id or --component.",
    );
  }
  if (options.interaction) {
    throw new Error(
      "Interaction baselines are not enabled yet; use an end-of-story baseline.",
    );
  }

  run("pnpm", ["build-storybook"]);

  const stories = loadStories();
  const selected = stories.filter((entry) =>
    options.storyId
      ? entry.id === options.storyId
      : entry.title === options.component,
  );
  if (selected.length === 0) {
    throw new Error(
      options.storyId
        ? `Unknown story id: ${options.storyId}`
        : `Unknown component title: ${options.component}`,
    );
  }

  const protectedStory = selected.find((entry) =>
    entry.tags?.includes(FAVA_REFERENCE_TAG),
  );
  if (protectedStory) {
    throw new Error(
      `${protectedStory.id} uses a frozen Fava reference. Run the dedicated Fava reference capture instead.`,
    );
  }

  const skippedStory = selected.find((entry) =>
    entry.tags?.includes("skip-visual"),
  );
  if (skippedStory) {
    throw new Error(
      `${skippedStory.id} is tagged skip-visual; remove the tag before creating a baseline.`,
    );
  }

  const storyIds = selected.map((entry) => entry.id);
  const grep = `(${storyIds.map(escapeRegExp).join("|")})$`;
  run(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-g",
      grep,
      `--update-snapshots=${options.createOnly ? "missing" : "all"}`,
    ],
    {
      PLAYWRIGHT_UPDATE_SNAPSHOTS: "1",
      PLAYWRIGHT_UPDATE_MODE: options.createOnly ? "missing" : "all",
      VISUAL_UPDATE_STORY_IDS: JSON.stringify(storyIds),
    },
  );
}

main();

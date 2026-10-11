import { defineVisualSuite } from "@lapismd/storybook-addon-visual-delta/playwright";

const visualReviewTags = new Set([
  "visual-pending",
  "visual-ready",
  "visual-approved",
  "visual-failed",
]);

const visualStoryFilter = process.env.VISUAL_STORY_FILTER
  ? new RegExp(process.env.VISUAL_STORY_FILTER, "i")
  : undefined;

defineVisualSuite({
  includeStory: (entry) =>
    (process.env.PLAYWRIGHT_UPDATE_SNAPSHOTS === "1" ||
      entry.tags?.some((tag) => visualReviewTags.has(tag)) === true) &&
    (!visualStoryFilter ||
      visualStoryFilter.test(
        [entry.id, entry.title, entry.name].filter(Boolean).join(" "),
      )),
});

import { defineVisualSuite } from "storybook-addon-visual-delta/playwright";

const visualReviewTags = new Set([
  "visual-pending",
  "visual-ready",
  "visual-approved",
  "visual-failed",
]);

defineVisualSuite({
  includeStory: (entry) =>
    process.env.PLAYWRIGHT_UPDATE_SNAPSHOTS === "1" ||
    entry.tags?.some((tag) => visualReviewTags.has(tag)) === true,
});

export const skeletonTokenNames = {
  background: "--ui-skeleton-background",
  radius: "--ui-skeleton-radius",
} as const;

export type SkeletonToken =
  (typeof skeletonTokenNames)[keyof typeof skeletonTokenNames];

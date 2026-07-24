export type FavaReferenceVisualDelta = {
  images: string[];
  opacity: number;
  colorInversion: boolean;
  align: "viewport";
  placement: "right";
  passThresholdPercent: number;
  deviceScaleFactor: number;
  viewport: { width: number; height: number };
};

export function favaReferenceUrl(id: string): string {
  return `/visual-baselines/fava-reference/screens/${id}-chromium-darwin.png`;
}

export function visualDeltaForFavaReference(
  id: string,
): FavaReferenceVisualDelta {
  return {
    images: [favaReferenceUrl(id)],
    opacity: 0.5,
    colorInversion: false,
    align: "viewport",
    placement: "right",
    passThresholdPercent: 0.1,
    deviceScaleFactor: 3,
    viewport: { width: 1280, height: 900 },
  };
}

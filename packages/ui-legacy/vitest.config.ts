import { defineConfig, mergeConfig } from "vitest/config";
import vite from "./vite.config";
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      environment: "node",
      include: [
        "src/foundation.tokens.spec.ts",
        "src/components/shadcn/native-primitives.spec.ts",
        "src/components/forms/**/*.spec.ts",
        "src/components/dashboard/**/*.spec.ts",
      ],
    },
  }),
);

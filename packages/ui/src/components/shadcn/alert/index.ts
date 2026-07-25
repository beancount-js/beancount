import {
  createVariants,
  type VariantProps,
} from "../../../lib/semantic-variants.js";

import Root from "./alert.svelte";
import Description from "./alert-description.svelte";
import Title from "./alert-title.svelte";

export const alertVariants = createVariants({
  base: "cn-alert-shadcn-alert-index-8-1",
  variants: {
    variant: {
      default: "cn-alert-shadcn-alert-index-11-1",
      destructive: "cn-alert-shadcn-alert-index-13-1",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type Variant = VariantProps<typeof alertVariants>["variant"];
export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export {
  Root,
  Description,
  Title,
  //
  Root as Alert,
  Description as AlertDescription,
  Title as AlertTitle,
};

export { alertTokenNames, type AlertToken } from "./alert.tokens.js";

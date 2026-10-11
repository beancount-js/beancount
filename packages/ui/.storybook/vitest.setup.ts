import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/svelte-vite";
import * as preview from "./preview";
const project = setProjectAnnotations([preview]);
beforeAll(project.beforeAll);

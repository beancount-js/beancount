import { LanguageSupport, StreamLanguage } from "@codemirror/language";

import { bqlCompletion } from "./autocomplete";
import { bqlStreamParser } from "./parser";

const bqlLanguage = StreamLanguage.define(bqlStreamParser);

export const bql = new LanguageSupport(
  bqlLanguage,
  bqlLanguage.data.of({
    autocomplete: bqlCompletion,
  }),
);

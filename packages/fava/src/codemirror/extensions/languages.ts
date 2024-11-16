import {
  Language,
  LanguageDescription,
  ParseContext,
} from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";

export const languages = [
  LanguageDescription.of({
    name: "YAML",
    alias: ["yml"],
    extensions: ["yaml", "yml"],
    load() {
      return Promise.resolve(yaml());
    },
  }),
];

export function getCodeParser(
  languages:
    | readonly LanguageDescription[]
    | ((info: string) => Language | LanguageDescription | null)
    | undefined,
  defaultLanguage?: Language,
) {
  return (info: string) => {
    if (info && languages) {
      let found = null;
      // Strip anything after whitespace
      info = /\S*/.exec(info)![0];
      if (typeof languages == "function") found = languages(info);
      else found = LanguageDescription.matchLanguageName(languages, info, true);
      if (found instanceof LanguageDescription)
        return found.support
          ? found.support.language.parser
          : ParseContext.getSkippingParser(found.load());
      else if (found) return found.parser;
    }
    return defaultLanguage ? defaultLanguage.parser : null;
  };
}

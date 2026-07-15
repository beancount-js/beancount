import { ZodIssueCode } from "zod";
import type { ZodIssue } from "zod";
import {
  beanCountOptionsSchema,
  defaultBeancountOptions,
  LedgerOption,
  optionKey,
  Plugin,
  Document,
  sorted,
} from "../core";
import type { BeancountOptions, Directives } from "../core";
import {
  Plugins,
  PLUGINS_AUTO,
  PLUGINS_POST,
  PLUGINS_PRE,
  type PluginType,
} from "../ops/plugins";
import { parseLedger } from "./parser";
import { BeanCountDocument } from "@beancount-js/parser";
import { validate } from "../ops/validation";
import { book } from "./booking";

export type DocumentLogger = (message: string) => void;
export type DocumentLoader = (
  filename: string,
  state: {
    errors: Array<LedgerError>;
    filenames: Set<string>;
    sources: Array<[string, boolean]>;
  },
) => string;

/** A source file supplied by a filesystem, browser directory, or in-memory store. */
export interface ProjectSource {
  path: string;
  contents: string;
}

export type ProjectSourceMap = Record<string, string>;

export type DocumentIncludeResolver = (
  parentPath: string,
  includePath: string,
) => string;

/**
 * Studio adapters can supply a raw default configuration for declared plugins.
 * The loader deliberately keeps the values opaque so plugins own their own
 * configuration format, just as they do in Beancount.
 */
export type PluginDefaults = Record<string, string>;
export type PluginDefaultsResolver = (entries: Directives) => PluginDefaults;

export function dedent(str: string) {
  const smallestIndent = Math.min(
    ...str
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.match(/^\s*/)![0].length),
  );
  return str
    .split("\n")
    .map((line) => line.slice(smallestIndent))
    .join("\n")
    .replaceAll(/(^\n+)|(\n+)$/g, "");
}

export interface LedgerError {
  readonly message: string;
  readonly context: Record<string, unknown>;
  with(attributes: Record<string, unknown>): LedgerError;
}

export class LoadError extends Error implements LedgerError {
  constructor(
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
  }

  with(attributes: Record<string, unknown>) {
    for (const [key, value] of Object.entries(attributes)) {
      this.context[key] = value;
    }
    return this;
  }
}

interface LoadProps {
  transform: boolean;
  plugins: Record<string, PluginType>;
  /** Default raw configuration keyed by declared plugin name. */
  pluginDefaults?: PluginDefaultsResolver;
  /**
   * A boolean, if set, remove the whitespace in front of the lines.
   */
  dedent: boolean;
  /**
   *  A file object or function to write timings to,
   *  or None, if it should remain quiet.
   */
  logTimings?: DocumentLogger;
  /**
   * A file object or function to write errors to,
   * or None, if it should remain quiet.
   */
  logErrors?: DocumentLogger;

  documentLoader?: DocumentLoader;
  includeResolver?: DocumentIncludeResolver;
}

export type { LoadProps };

function logTime<T>(
  operationName: string,
  logTimings: DocumentLogger | undefined,
  indent: number,
  operation: () => T,
): T {
  if (!logTimings) {
    return operation();
  }
  const start = performance.now();
  const result: T = operation();
  const end = performance.now();

  if (logTimings) {
    const indentString = "      ".repeat(indent);
    logTimings(
      `Operation: ${operationName.padEnd(48)} Time: ${indentString}${(end - start).toFixed(0)} ms`,
    );
  }

  return result;
}

function normPath(path: string): string {
  // Replace backslashes with forward slashes
  path = path.replace(/\\/g, "/").replace(/\/+$/, "");
  // Split path by slashes and backslashes
  const parts = path.split(/[/\\]+/);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      // Move up a directory, if possible
      if (stack.length > 0 && stack[stack.length - 1] !== "..") {
        stack.pop();
      } else {
        stack.push(part);
      }
    } else if (part !== "." && part !== "") {
      // Add the part to the path if it's not '.' or empty
      stack.push(part);
    }
  }

  // Join all parts with '/' to form the normalized path
  return stack.join("/") || ".";
}

/**
 * Normalise a path relative to a project root. Absolute paths and paths which
 * escape that root are rejected so a project cannot load arbitrary files.
 */
export function normalizeProjectPath(path: string): string {
  const input = path.replace(/\\/g, "/");
  if (!input || input.startsWith("/")) {
    throw new LoadError(`Project file path must be relative: "${path}"`);
  }
  const parts: string[] = [];
  for (const part of input.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) {
        throw new LoadError(`Project file path escapes its root: "${path}"`);
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  if (!parts.length) {
    throw new LoadError(`Project file path must name a file: "${path}"`);
  }
  return parts.join("/");
}

export function resolveProjectInclude(
  parentPath: string,
  includePath: string,
): string {
  const parent = normalizeProjectPath(parentPath);
  const parentDirectory = parent.includes("/")
    ? parent.slice(0, parent.lastIndexOf("/"))
    : "";
  return normalizeProjectPath(
    parentDirectory ? `${parentDirectory}/${includePath}` : includePath,
  );
}

/**
 * Open a Beancount input string, parse it, run transformations and validate.
 * @param contents  A Beancount input string.
 * @param props
 */
export function loadString(contents: string, props: Partial<LoadProps> = {}) {
  const opts = {
    transform: true,
    plugins: {},
    dedent: false,
    ...props,
  };
  return parseRecursive([[contents, false]], opts);
}

/**
 * Parse an entry file plus its recursive includes from a bounded project
 * source-map. This is intentionally independent from Node's filesystem so the
 * exact same ledger can run in the server and browser adapters.
 */
export function loadProjectSources(
  entryFile: string,
  sources: Iterable<ProjectSource> | ProjectSourceMap,
  props: Partial<LoadProps> = {},
) {
  const sourceMap: ProjectSourceMap = {};
  const records =
    Symbol.iterator in Object(sources)
      ? (sources as Iterable<ProjectSource>)
      : Object.entries(sources as ProjectSourceMap).map(([path, contents]) => ({
          path,
          contents,
        }));
  for (const source of records) {
    const path = normalizeProjectPath(source.path);
    if (path in sourceMap) {
      throw new LoadError(`Duplicate project source: "${path}"`, { path });
    }
    sourceMap[path] = source.contents;
  }
  const root = normalizeProjectPath(entryFile);
  return parseRecursive([[root, true]], {
    transform: true,
    plugins: {},
    dedent: false,
    ...props,
    includeResolver: resolveProjectInclude,
    documentLoader: (filename) => sourceMap[filename],
  });
}

export function parseRecursive(
  sources: Array<[string, boolean]> | string,
  props: LoadProps,
): [Directives, Array<LedgerError>, BeancountOptions] {
  const { logTimings, documentLoader, includeResolver } = props;
  if (typeof sources === "string") {
    return parseRecursive([[sources, false]], props);
  }
  const parseErrors: Array<LedgerError> = [];
  const entries: Directives = [];

  // A stack of sources to be parsed.
  const sourceStack: Array<[string, boolean]> = [...sources];
  let optionsMap: Record<string, unknown> | null = null;

  // A list of absolute filenames that have been parsed in the past, used to
  // detect and avoid duplicates (cycles).
  const filenamesSeen = new Set<string>();
  return logTime("beancount.parser.parser", logTimings, 1, () => {
    const files: Array<{
      filename: string;
      options: Record<string, unknown>;
      document: BeanCountDocument;
    }> = [];
    while (sourceStack.length) {
      // eslint-disable-next-line prefer-const
      let [source, isFile] = sourceStack.pop()!;
      const isTopLevel = optionsMap === null;
      const sourceFileName = isFile ? normPath(source) : "";
      if (isFile) {
        if (filenamesSeen.has(sourceFileName)) {
          parseErrors.push(
            new LoadError(`Duplicate filename parsed: "${sourceFileName}"`, {
              "<load>": 0,
              file: sourceFileName,
            }),
          );
          continue;
        }
        filenamesSeen.add(sourceFileName);

        if (!documentLoader) {
          parseErrors.push(
            new LoadError(`No document loader for file: "${sourceFileName}"`, {
              file: sourceFileName,
            }),
          );
          continue;
        }

        const errors: Array<LedgerError> = [];
        const state = {
          errors,
          filenames: filenamesSeen,
          sources: sourceStack,
        };
        source = logTime("beancount.loader.load_file", logTimings, 2, () => {
          const data = documentLoader(sourceFileName, state);
          if (data === null || data === undefined) {
            parseErrors.push(
              new LoadError(
                `Failed to load include file: "${sourceFileName}"`,
                {
                  file: sourceFileName,
                },
              ),
            );
            return "";
          }
          return props.dedent ? dedent(data) : data;
        });
        parseErrors.push(
          ...errors.map((it) => it.with({ file: sourceFileName })),
        );
      }
      source = props.dedent ? dedent(source) : source;

      if (!source?.trim()) {
        continue;
      }
      const doc = logTime(
        "beancount.parser.parser.parse_string",
        logTimings,
        2,
        () =>
          parseLedger(source, {
            transform: props.transform,
            filename: sourceFileName,
            attributes: { filename: sourceFileName },
          }),
      );

      doc.sources.forEach((it) => {
        try {
          sourceStack.push([
            includeResolver
              ? includeResolver(sourceFileName, it)
              : normPath(it),
            true,
          ]);
        } catch (error) {
          parseErrors.push(
            error instanceof LoadError
              ? error.with({ file: sourceFileName })
              : new LoadError(`Failed to resolve include "${it}"`, {
                  file: sourceFileName,
                  error,
                }),
          );
        }
      });

      parseErrors.push(
        ...doc.errors.map(
          (it) => new LoadError(it.message, { file: sourceFileName, ...it }),
        ),
      );

      entries.push(...doc.directives);
      if (isTopLevel) {
        optionsMap = doc.optionsMap;
        optionsMap["filename"] = sourceFileName;
        files.push({
          filename: sourceFileName,
          document: doc.document,
          options: doc.optionsMap,
        });
      } else {
        const opts = doc.optionsMap;
        opts["filename"] = sourceFileName;
        opts["include"] = [...filenamesSeen].sort();
        opts["files"] = [...files];
        files.push({
          filename: sourceFileName,
          document: doc.document,
          options: opts,
        });
      }
    }
    if (!optionsMap) {
      optionsMap = defaultBeancountOptions();
    }
    optionsMap["include"] = [...filenamesSeen].sort();
    optionsMap["files"] = files;
    return runTransformations(
      loadBeancountOptions([sorted(entries), parseErrors, optionsMap], props),
      props,
    );
  });
}

export function loadBeancountOptions(
  data: [Directives, Array<LedgerError>, Record<string, unknown>],
  props: LoadProps,
): [Directives, Array<LedgerError>, BeancountOptions] {
  const [entries, errors, optionsMap] = data;
  let options: BeancountOptions = defaultBeancountOptions();
  const source: Record<string, unknown> = { ...options };

  for (let [key, value] of Object.entries(optionsMap)) {
    key = optionKey(key);
    const existing = source[key];
    if (existing) {
      if (Array.isArray(existing)) {
        value = Array.isArray(value) ? value : [value];
        source[key] = value;
      } else {
        source[key] = value;
      }
    } else {
      source[key] = value;
    }
  }

  const optionDirectives: Record<string, LedgerOption> = {};
  const plugins: Array<string> = [];
  const documents: Array<string> = [];
  entries.forEach((entry) => {
    if (entry instanceof LedgerOption) {
      optionDirectives[entry.key] = entry;
    } else if (entry instanceof Plugin) {
      const plugin = props.plugins[entry.name] ?? Plugins[entry.name];
      if (!plugin) {
        errors.push(
          new LoadError(`Unsupported plugin ${entry.name}`, {
            lineno: entry.lineno,
            directive: entry,
          }),
        );
        return;
      }
      plugins.push(entry.name);
    } else if (entry instanceof Document) {
      documents.push(entry.filename);
    }
  });
  source.plugin = [...new Set(plugins)];
  source.documents = documents;
  const beancount = beanCountOptionsSchema.strict().safeParse(source);

  if (!beancount.success) {
    beancount.error.issues.forEach((error: ZodIssue) => {
      const key =
        error.code === ZodIssueCode.unrecognized_keys
          ? error.keys[0]
          : error.path[0];
      const keyString = String(key);
      errors.push(
        new LoadError(
          `${keyString}: ${error.message}${error.code ? ` (${error.code})` : ""}`,
          { error, lineno: optionDirectives[keyString]?.lineno ?? 0 },
        ),
      );
    });
  } else {
    options = beancount.data;
  }
  return [entries, errors, options];
}

/**
 * Run the various transformations on the entries.
 * This is where entries are being synthesized, checked, plugins are run, etc.
 *
 * @param entries A list of directives as read from the parser.
 * @param errors  A list of errors so far.
 * @param optionsMap  An options dict as read from the parser.
 * @param logTimings A function to write timing log entries to, or None, if it should be quiet.
 */
export function runTransformations(
  data: [Directives, Array<LedgerError>, BeancountOptions],
  props: LoadProps,
): [Directives, Array<LedgerError>, BeancountOptions] {
  const [entries, errors, options] = data;
  if (!props.transform) {
    return [sorted(entries), errors, options];
  }
  let response: Directives = sorted(entries);
  const [updatedEntries, bookingErrors] = book(entries, options);
  errors.push(...bookingErrors);
  response = updatedEntries;

  type PluginInvocation = {
    name: string;
    plugin: PluginType;
    configuration?: string;
    directive?: Plugin;
  };

  const pluginDefaults = props.pluginDefaults?.(entries) ?? {};
  const declaredPluginNames = new Set<string>();
  const declared: PluginInvocation[] = [];

  entries.forEach((entry) => {
    if (!(entry instanceof Plugin)) return;
    declaredPluginNames.add(entry.name);
    const plugin = props.plugins[entry.name] ?? Plugins[entry.name];
    // Unknown declarations are already reported while loading Beancount options.
    if (!plugin) return;
    declared.push({
      name: entry.name,
      plugin,
      configuration:
        entry.options === undefined
          ? pluginDefaults[entry.name]
          : typeof entry.options === "string"
            ? entry.options
            : entry.options.code,
      directive: entry,
    });
  });

  Object.keys(pluginDefaults).forEach((name) => {
    if (!declaredPluginNames.has(name)) {
      errors.push(
        new LoadError(
          `Plugin configuration provided for undeclared plugin ${name}`,
          { plugin: name },
        ),
      );
    }
  });

  const defaults = (names: string[]): PluginInvocation[] =>
    names
      .map((name) => {
        const plugin = props.plugins[name] ?? Plugins[name];
        if (!plugin) {
          errors.push(new LoadError(`Unsupported plugin: ${name}`));
          return undefined;
        }
        return { name, plugin };
      })
      .filter((invocation): invocation is PluginInvocation => !!invocation)
      .sort((a, b) => b.plugin.order - a.plugin.order);

  const invocations =
    options.plugin_processing_mode === "default"
      ? [
          ...defaults(PLUGINS_PRE),
          ...declared,
          ...defaults(PLUGINS_AUTO),
          ...defaults(PLUGINS_POST),
        ]
      : declared;

  invocations.forEach((invocation) => {
    if (
      invocation.configuration !== undefined &&
      invocation.plugin.supportsConfig === false
    ) {
      errors.push(
        new LoadError(
          `Plugin ${invocation.name} does not support configuration`,
          {
            directive: invocation.directive,
            lineno: invocation.directive?.lineno,
          },
        ),
      );
      return;
    }
    logTime(
      "beancount.plugin." + invocation.plugin.id,
      props.logTimings,
      2,
      () => {
        const [updatedEntries, pluginErrors] = invocation.plugin.plugin(
          response,
          options,
          invocation.configuration,
        );
        response = sorted(updatedEntries);
        pluginErrors.forEach((error) => {
          if (invocation.directive) {
            error.with({
              plugin: invocation.name,
              directive: invocation.directive,
              lineno: invocation.directive.lineno,
            });
          }
          errors.push(error);
        });
      },
    );
  });

  errors.push(...validate(response, options));

  return [response, errors, options];
}

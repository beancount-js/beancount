import { TextFileView, TFile, WorkspaceLeaf, type ViewState } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { unfoldAll } from "@codemirror/language";
import { search } from "../extensions/search/search";
import { linter, type ValidatorInput } from "./lint";
import { format } from "./format";
import { basicSetup } from "./setup";
import { foldAll } from "../extensions/foldAll";

export abstract class YamlEditor<T> extends TextFileView {
  private view!: EditorView;
  private searchContainer!: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    readonly schema: object,
    readonly extension: Extension = [],
  ) {
    super(leaf);
    this.searchContainer = this.contentEl.createDiv();

    this.addAction("fold-vertical", "Fold All", () => {
      foldAll(this.view);
    });
    this.addAction("unfold-vertical", "Unfold All", () => {
      unfoldAll(this.view);
    });
    this.addAction("baseline", "Format", () => {
      format(this.view);
    });

    this.containerEl.addEventListener("click", this.clickHandler.bind(this));
  }

  onload(): void {
    this.containerEl.addEventListener("click", this.clickHandler.bind(this));
  }

  onunload(): void {
    this.view.destroy();
    this.containerEl.children[1].empty();
    this.containerEl.removeEventListener("click", this.clickHandler);
  }

  validate(state: ValidatorInput<T>) {}

  abstract canAcceptExtension(extension: string): boolean;

  abstract getIcon(): string;

  abstract getViewType(): string;

  public getDisplayText(): string {
    return this.file?.basename || "";
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean = false): void {
    this.data = data;
    if (clear) {
      this.clear();
    }
  }

  public async onLoadFile(file: TFile): Promise<void> {
    this.file = file;
    let fileData = await this.app.vault.read(file);
    this.setViewData(fileData);
    this.redraw();
  }

  clear(): void {}

  async save(clear?: boolean): Promise<void> {
    try {
      if (this.file) {
        this.app.vault.modify(this.file, this.data);
        if (clear) {
          this.clear();
        }
      }
    } catch (err) {
      console.error("[Editor:Yaml]: Failed to save file", err);
    }
  }

  public showSearch(replace?: boolean): void {
    openSearchPanel(this.view);
    const el = document.querySelector<HTMLInputElement>(
      "input.document-search-input",
    );
    if (el) {
      const text = this.view.state.sliceDoc(
        this.view.state.selection.main.from,
        this.view.state.selection.main.to,
      );
      if (text) {
        el.value = text;
        el.select();
      }
      el.blur();
      el.focus();
    }
  }

  clickHandler(event: Event) {
    if (event.target instanceof Element) {
      if (event.target.hasClass("cm-hashtag")) {
        this.queryObsidian("#" + event.target.textContent);
      }
    }
  }

  private queryObsidian(query: string) {
    try {
      const app: any = this.app;
      app.internalPlugins.plugins["global-search"].instance.openGlobalSearch(
        query,
      );
    } catch (e) {
      console.error("[Ledger]: Failed to query obsidian", e);
    }
  }

  public readonly redraw = (): void => {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
    this.view = new EditorView({
      state: EditorState.create({
        doc: this.getViewData(),
        extensions: [
          basicSetup,
          this.extension,
          EditorView.updateListener.of((event) => {
            if (event.docChanged) {
              this.setViewData(event.state.doc.toString());
              this.requestSave();
            }
          }),
          linter(this.schema, (state: ValidatorInput<T>) => {
            this.validate(state);
            this.contentEl.dataset["valid"] = state.errors.length
              ? "false"
              : "true";
          }),
        ],
      }),
      parent: contentEl
        .createDiv({ cls: "beancount" })
        .createDiv({ cls: "stone" })
        .createDiv({ cls: "beancount-editor" })
        .createDiv({
          cls: "markdown-source-view cm-s-obsidian mod-cm6 is-readable-line-width is-live-preview",
        })
        .createDiv({ cls: "cm-scroller" })
        .createDiv({ cls: "cm-sizer" })
        .createDiv({ cls: "cm-contentContainer" }),
    });
  };
}

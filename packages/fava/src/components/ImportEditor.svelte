<script lang="ts">
import {
    EditorView,
} from "@codemirror/view";
import {
    EditorState,
} from "@codemirror/state";
import Button from "$lib/components/ui/button/button.svelte";
import {
    FoldVertical,
    UnfoldVertical,
    Save
} from "lucide-svelte";
import {
    replaceContents
} from "../codemirror/extensions/transactions";
import {
    useContext
} from "../context";
import {
    importEditor
} from "../yaml/setup";
import {
    formatLedger
} from "../codemirror/beancount/format";
import {
    foldAll
} from "../codemirror/extensions/foldAll";
import {
    unfoldAll
} from "@codemirror/language";
import {
    openSearchPanel
} from "@codemirror/search";
import {
    onMount
} from "svelte";
import {
    stringify
} from "yaml";
import * as Menubar from "$lib/components/ui/menubar";
import {
    toggleComment,
} from "@codemirror/commands";
import {
    findNext,
    findPrevious,
} from "@codemirror/search";
import {
    goToLine,
    showGotoLine
} from "../codemirror/extensions/gotoline";
import {
    useNavigation
} from "../router/router";
import {
    importFile as importFileSchema,
    type ImportFile
} from "../import/schema";
import { ledgerSetup } from "../codemirror/beancount/setup";
    import { format } from "../yaml/format";
    import { importerStore } from "../import/store";
    import { yamlParser } from "../lib/store";

const {
    router: {
        activeRoute
    }
} = useNavigation();
const {
    importFile,
    ledgerSource
} = useContext();
export let formatOnSave: boolean = true;
let editor: EditorView;
let line: string = "";

const codeMirror = (node: HTMLDivElement, contents: string) => {
    editor = new EditorView({
        state: EditorState.create({
            doc: contents,
            extensions: [
                importEditor,
                ledgerSetup(() => $ledgerSource),
            ]
        }),
        parent: node
            .createDiv({
                cls: "markdown-source-view cm-s-obsidian mod-cm6 is-readable-line-width is-live-preview",
            })
            .createDiv({
                cls: "cm-scroller"
            })
            .createDiv({
                cls: "cm-contentContainer"
            })
    });

    if (line) {
        goToLine(editor, line);
    }
    return {
        update(contents: string) {
            if (contents) {
                editor.dispatch({
                    ...replaceContents(editor.state, contents),
                });
            }
        },
        destroy() {}
    };
};

function showSearch() {
    openSearchPanel(editor);
    const el = document.querySelector < HTMLInputElement > (
        "input.document-search-input",
    );
    if (el) {
        const text = editor.state.sliceDoc(
            editor.state.selection.main.from,
            editor.state.selection.main.to,
        );
        if (text) {
            el.value = text;
            el.select();
        }
        el.blur();
        el.focus();
    }
}

$: if (editor && $activeRoute.query["line"] && line !== $activeRoute.params["line"]) {
    line = $activeRoute.query["line"];
    goToLine(editor, line);
}

function handleSave() {
    if (formatOnSave) {
        format(editor);
    }
    const data = [...$importerStore].filter(it => it.filename !== $importFile?.filename);
    const file = yamlParser(importFileSchema.strict()).safeParse(editor.state.doc.toString());
    if (file.success) {
        importerStore.set([file.data, ...data]);
        importFile.set(file.data);
    } else {
        console.error('Yaml::Error', file.error.errors);
    }
}

function yamlData(file: ImportFile | null) {
    if (!file) {
        return stringify({
            filename: "",
            data: []
        });
    }
    return stringify({
        filename: file.filename,
        data: file.data
    }, {blockQuote: "literal"})
}

onMount(
    function() {
        document.addEventListener("showSearch", showSearch);
        document.addEventListener("saveLedger", handleSave);
        return () => {
            document.removeEventListener("showSearch", showSearch);
            document.removeEventListener("saveLedger", handleSave);
        }
    }
);
</script>
<div class="pr-4">
    <div class="flex justify-between">
        <div class="pl-2 pb-2">
            <Menubar.Root>
                <Menubar.Menu>
                    <Menubar.Trigger>File</Menubar.Trigger>
                    <Menubar.Content>
                        <Menubar.CheckboxItem bind:checked={formatOnSave}  on:click={() => formatOnSave = !formatOnSave}>
                            Format on Save
                        </Menubar.CheckboxItem>
                        <Menubar.Item inset on:click={() => showGotoLine(editor)}>Go To Line</Menubar.Item>
                    </Menubar.Content>
                </Menubar.Menu>
                <Menubar.Menu>
                    <Menubar.Trigger>Edit</Menubar.Trigger>
                    <Menubar.Content>
                        <Menubar.Item inset on:click={() => format(editor)}>
                            Format <Menubar.Shortcut class="pl-2">⌘ + D</Menubar.Shortcut>
                        </Menubar.Item>
                        <Menubar.Item inset on:click={() => toggleComment(editor)}>
                            Toggle Comment <Menubar.Shortcut class="pl-2">⌘ + /</Menubar.Shortcut>
                        </Menubar.Item>
                        <Menubar.Item on:click={() => unfoldAll(editor)}><UnfoldVertical class="size-4 mr-2" /> Open all folds</Menubar.Item>
                        <Menubar.Item on:click={() => foldAll(editor)}><FoldVertical class="size-4 mr-2" /> Close all folds</Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Sub>
                            <Menubar.SubTrigger class="pl-8">Find</Menubar.SubTrigger>
                            <Menubar.SubContent>
                                <Menubar.Item on:click={showSearch}>Find...</Menubar.Item>
                                <Menubar.Item on:click={() => findNext(editor)}>Find Next</Menubar.Item>
                                <Menubar.Item on:click={() => findPrevious(editor)}>Find Previous</Menubar.Item>
                            </Menubar.SubContent>
                        </Menubar.Sub>
                    </Menubar.Content>
                </Menubar.Menu>
            </Menubar.Root>
        </div>
        <div>
            <Button size="sm" aria-label="Save Ledger" class="clickable-icon" variant="default" on:click={() => handleSave()}>
                <Save class="size-4 mr-1" /> Save
            </Button>
        </div>
    </div>
</div>
<div class="scroll-container pb-[60vh] pt-0">
    <div class="relative beancount-editor">
        <div use:codeMirror={yamlData($importFile)}>
        </div>
    </div>
</div>

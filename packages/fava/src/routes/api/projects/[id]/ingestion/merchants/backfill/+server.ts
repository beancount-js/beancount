import { json } from "@sveltejs/kit";
import {
  backfillMerchantsFromLedger,
  pruneThinMerchantsFromCatalog,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

export async function POST({ params }: { params: { id: string } }) {
  try {
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const store = serverIngestion();
    const ledgerFiles = snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    }));

    const pruned = await pruneThinMerchantsFromCatalog({
      projectId: params.id,
      entryFile: snapshot.project.entryFile,
      files: ledgerFiles,
      merchants: store.merchants,
    });

    const result = await backfillMerchantsFromLedger({
      projectId: params.id,
      entryFile: snapshot.project.entryFile,
      files: pruned.files,
      merchants: store.merchants,
    });

    const changed = result.files.filter((file) => {
      const previous = snapshot.ledgerFiles.find(
        (item) => item.path === file.path,
      );
      return previous && previous.contents !== file.contents;
    });

    for (const file of changed) {
      const revision = snapshot.revisions.find(
        (item) => item.path === file.path,
      )?.revision;
      if (!revision) {
        throw new Error(`Missing revision for ${file.path}`);
      }
      await workspace.writeFile(
        params.id,
        { path: file.path, contents: file.contents },
        { expectedRevision: revision },
      );
    }

    return json({
      createdProfiles: result.createdProfiles,
      patchedTransactions: result.patchedTransactions,
      skipped: result.skipped,
      removedProfiles: pruned.removedProfiles,
      clearedTransactions: pruned.clearedTransactions,
      filesChanged: changed.map((file) => file.path),
      snapshot: await workspace.readProject(params.id),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

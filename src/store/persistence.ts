// CONTRACT STUB — implemented by the Canvas Core agent (owner of src/store/**).
// Other agents may import these signatures; do not change them without the Orchestrator.
import type { BoardDoc, ID } from '../model/types';

/** Seed a brand-new board's content (used by templates / duplicate). Resolves once durably saved. */
export async function writeInitialDoc(boardId: ID, doc: BoardDoc): Promise<void> {
  void boardId; void doc;
  throw new Error('writeInitialDoc: not implemented yet (Canvas Core)');
}

/** Read a board's current content without opening an editor (export, share, duplicate, thumbnails). */
export async function readBoardDoc(boardId: ID): Promise<BoardDoc> {
  void boardId;
  throw new Error('readBoardDoc: not implemented yet (Canvas Core)');
}

/** Permanently remove a board's content from this device. */
export async function deleteBoardData(boardId: ID): Promise<void> {
  void boardId;
  throw new Error('deleteBoardData: not implemented yet (Canvas Core)');
}

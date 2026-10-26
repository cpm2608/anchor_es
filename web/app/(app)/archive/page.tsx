"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArchiveRestore, Trash2 } from "lucide-react";
import * as React from "react";
import { AppPage, PageTitle } from "@/components/layout/app-page";
import { IconButton } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState, LoadFailedState } from "@/components/ui/empty-state";
import { SelectionBar } from "@/components/ui/selection-bar";
import { toast } from "@/components/ui/toast";
import { Tip } from "@/components/ui/tooltip";
import {
  bulkArchiveNotes,
  bulkDeleteNotes,
  getArchivedNotes,
  restoreNote,
  unarchiveNote,
} from "@/features/notes/api";
import {
  NoSearchResults,
  NoteListActions,
} from "@/features/notes/components/note-list-actions";
import {
  NotesBoard,
  NotesBoardSkeleton,
} from "@/features/notes/components/notes-board";
import { ShareDialog } from "@/features/notes/components/share-dialog";
import { useNoteList } from "@/features/notes/hooks/use-note-list";
import { useRefreshNotes } from "@/features/notes/hooks/use-refresh-notes";
import { deletedNotesText, deleteNotesWarning } from "@/features/notes/trash";
import type { Note } from "@/features/notes/types";
import { eachLimited } from "@/lib/each";
import { plural } from "@/lib/utils";

const NO_NOTES: Note[] = [];

export default function ArchivePage() {
  const refresh = useRefreshNotes();
  const [confirmRemove, setConfirmRemove] = React.useState<{
    ids: string[];
    sharedCount: number;
  } | null>(null);
  const [sharingNote, setSharingNote] = React.useState<Note | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["notes", "archived"],
    queryFn: getArchivedNotes,
  });
  const notes = data ?? NO_NOTES;
  const loadFailed = isError && !data;
  const list = useNoteList(notes);

  const undo = async (run: () => Promise<unknown>) => {
    list.prepareCardMotion();
    try {
      await run();
    } catch {
      toast.error("No se pudo deshacer la acción");
    }
    refresh();
  };

  const noteAction = useMutation({
    mutationFn: async ({
      kind,
      ids,
    }: {
      kind: "unarchive" | "trash";
      ids: string[];
    }) => {
      if (kind === "unarchive") await eachLimited(ids, unarchiveNote);
      else await bulkDeleteNotes(ids);
    },
    onMutate: ({ ids }) => {
      list.prepareCardMotion();
      return {
        ownedIds: ids.filter(
          (id) => notes.find((n) => n.id === id)?.permission === "owner",
        ),
      };
    },
    onSuccess: (_, { kind, ids }, context) => {
      refresh();
      list.stopPicking();
      setConfirmRemove(null);
      if (kind === "unarchive") {
        toast.success(
          ids.length === 1
            ? "Nota desarchivada"
            : `${ids.length} notas desarchivadas`,
          {
            undo: () => undo(() => bulkArchiveNotes(ids)),
          },
        );
        return;
      }
      const ownedIds = context?.ownedIds ?? [];
      toast.success(
        deletedNotesText(ownedIds.length, ids.length - ownedIds.length),
        ownedIds.length
          ? { undo: () => undo(() => eachLimited(ownedIds, restoreNote)) }
          : undefined,
      );
    },
    onError: (_, variables) => {
      const verb = variables.kind === "unarchive" ? "desarchivar" : "eliminar";
      toast.error(
        `No se pudo ${verb} ${variables.ids.length === 1 ? "la nota" : "las notas"}`,
        { retry: () => noteAction.mutate(variables) },
      );
    },
  });

  const mutateNotes = noteAction.mutate;
  const renderActions = React.useCallback(
    (note: Note) => (
      <Tip label="Desarchivar">
        <IconButton
          size="sm"
          label="Desarchivar"
          onClick={() => mutateNotes({ kind: "unarchive", ids: [note.id] })}
        >
          <ArchiveRestore />
        </IconButton>
      </Tip>
    ),
    [mutateNotes],
  );

  const deleteChosen = () => {
    const ids = list.chosen.map((n) => n.id);
    const sharedCount = list.chosen.filter(
      (n) => n.permission !== "owner",
    ).length;
    if (sharedCount) setConfirmRemove({ ids, sharedCount });
    else noteAction.mutate({ kind: "trash", ids });
  };

  const hasNotes = notes.length > 0;
  const removeCount = confirmRemove?.ids.length ?? 0;
  const removeSharedCount = confirmRemove?.sharedCount ?? 0;
  return (
    <>
      <AppPage
        scrollKey="archive"
        title={
          <PageTitle
            count={isLoading || loadFailed ? undefined : list.visible.length}
          >
            Archivo
          </PageTitle>
        }
        actions={
          hasNotes && (
            <NoteListActions list={list} placeholder="Buscar en archivo" />
          )
        }
      >
        <p className="m-0 -mt-2 mb-1 text-muted-foreground text-ui">
          Las notas archivadas están ocultas de tu lista principal.
        </p>
        <NotesBoardSkeleton loading={isLoading} />
        {loadFailed && (
          <LoadFailedState
            title="No se pudo cargar el archivo"
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        )}
        {!isLoading && !loadFailed && !hasNotes && (
          <EmptyState illustration="archive" title="No hay notas archivadas">
            Archiva notas que quieras conservar pero que no necesites ver todos los días.
          </EmptyState>
        )}
        {hasNotes && !list.visible.length && <NoSearchResults list={list} />}
        {list.visible.length > 0 && (
          <NotesBoard
            ref={list.boardRef}
            layout={list.layout}
            picking={list.picking}
            picked={list.picked}
            onPick={list.onPick}
            onShare={setSharingNote}
            renderActions={renderActions}
            groups={[{ key: "all", notes: list.shown }]}
          />
        )}
      </AppPage>

      <SelectionBar
        open={list.picking}
        count={list.chosen.length}
        total={list.shown.length}
        onToggleAll={list.toggleAll}
        onClose={list.stopPicking}
        actions={[
          {
            key: "unarchive",
            label: "Desarchivar",
            icon: <ArchiveRestore aria-hidden />,
            onClick: () =>
              noteAction.mutate({
                kind: "unarchive",
                ids: list.chosen.map((n) => n.id),
              }),
          },
          {
            key: "delete",
            label: "Eliminar",
            icon: <Trash2 aria-hidden />,
            onClick: deleteChosen,
          },
        ]}
      />

      <ConfirmationDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={`¿Eliminar ${removeCount === 1 ? "la nota" : `las ${removeCount} notas`}?`}
        description={deleteNotesWarning(
          removeCount - removeSharedCount,
          removeSharedCount,
        )}
        confirmLabel="Eliminar"
        busyLabel="Eliminando…"
        isPending={noteAction.isPending}
        onConfirm={() =>
          confirmRemove &&
          noteAction.mutate({ kind: "trash", ids: confirmRemove.ids })
        }
      />
      {sharingNote && (
        <ShareDialog
          open
          noteId={sharingNote.id}
          title={sharingNote.title}
          onOpenChange={(open) => !open && setSharingNote(null)}
        />
      )}
    </>
  );
}

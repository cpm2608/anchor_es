"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { AppPage, PageTitle, TopBarButton } from "@/components/layout/app-page";
import { IconButton } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState, LoadFailedState } from "@/components/ui/empty-state";
import { SelectionBar } from "@/components/ui/selection-bar";
import { toast } from "@/components/ui/toast";
import { Tip } from "@/components/ui/tooltip";
import {
  deleteNote,
  getTrashedNotes,
  permanentDeleteNote,
  restoreNote,
} from "@/features/notes/api";
import {
  NoSearchResults,
  NoteListActions,
} from "@/features/notes/components/note-list-actions";
import {
  NotesBoard,
  NotesBoardSkeleton,
} from "@/features/notes/components/notes-board";
import { useNoteList } from "@/features/notes/hooks/use-note-list";
import { useRefreshNotes } from "@/features/notes/hooks/use-refresh-notes";
import {
  daysUntilDeletion,
  TRASH_RETENTION_DAYS,
} from "@/features/notes/trash";
import type { Note } from "@/features/notes/types";
import { eachLimited } from "@/lib/each";
import { plural } from "@/lib/utils";

const NO_NOTES: Note[] = [];

const timeLeft = (note: Note) =>
  `${plural(daysUntilDeletion(note), "day")} left`;

export default function TrashPage() {
  const refresh = useRefreshNotes();
  const [pendingDelete, setPendingDelete] = React.useState<{
    ids: string[];
    all?: boolean;
  } | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["notes", "trashed"],
    queryFn: getTrashedNotes,
  });
  const notes = data ?? NO_NOTES;
  const loadFailed = isError && !data;
  const list = useNoteList(notes);

  const restore = useMutation({
    mutationFn: (ids: string[]) => eachLimited(ids, restoreNote),
    onMutate: (ids) => {
      list.prepareCardMotion();
      return new Map(
        ids.map((id) => [id, notes.find((n) => n.id === id)?.stateChangedAt]),
      );
    },
    onSuccess: (_, ids, trashDates) => {
      refresh();
      list.stopPicking();
      toast.success(
        ids.length === 1
          ? "Nota restaurada"
          : `${ids.length} notas restauradas`,
        {
          undo: async () => {
            list.prepareCardMotion();
            try {
              await eachLimited(ids, (id) =>
                deleteNote(id, trashDates?.get(id)),
              );
            } catch {
              toast.error("No se pudo deshacer la acción");
            }
            refresh();
          },
        },
      );
    },
    onError: (_, ids) =>
      toast.error(`No se pudo restaurar ${ids.length === 1 ? "la nota" : "las notas"}`, {
        retry: () => restore.mutate(ids),
      }),
  });

  const remove = useMutation({
    mutationFn: ({ ids }: { ids: string[]; all?: boolean }) =>
      eachLimited(ids, permanentDeleteNote),
    onMutate: () => list.prepareCardMotion(),
    onSuccess: async (_, { ids, all }) => {
      await refresh();
      list.stopPicking();
      setPendingDelete(null);
      toast.success(
        all
          ? "Papelera vaciada"
          : ids.length === 1
            ? "Nota eliminada definitivamente"
            : `${ids.length} notas eliminadas definitivamente`,
      );
    },
    onError: (_, variables) => {
      refresh();
      toast.error(
        variables.all
          ? "No se pudo vaciar la papelera"
          : `No se pudo eliminar ${variables.ids.length === 1 ? "la nota" : "las notas"}`,
        { retry: () => remove.mutate(variables) },
      );
    },
  });

  const restoreNotes = restore.mutate;
  const renderActions = React.useCallback(
    (note: Note) => (
      <>
        <Tip label="Restaurar">
          <IconButton
            size="sm"
            label="Restaurar"
            onClick={() => restoreNotes([note.id])}
          >
            <RotateCcw />
          </IconButton>
        </Tip>
        <Tip label="Eliminar permanentemente">
          <IconButton
            size="sm"
            tone="danger"
            label="Eliminar permanentemente"
            onClick={() => setPendingDelete({ ids: [note.id] })}
          >
            <Trash2 />
          </IconButton>
        </Tip>
      </>
    ),
    [restoreNotes],
  );

  const hasNotes = notes.length > 0;
  const chosenIds = list.chosen.map((n) => n.id);
  const deleteCount = pendingDelete?.ids.length ?? 0;
  return (
    <>
      <AppPage
        scrollKey="trash"
        title={
          <PageTitle
            count={isLoading || loadFailed ? undefined : list.visible.length}
          >
            Papelera
          </PageTitle>
        }
        actions={
          hasNotes && (
            <NoteListActions list={list} placeholder="Buscar en la papelera">
              <TopBarButton
                icon={<Trash2 aria-hidden />}
                onClick={() =>
                  setPendingDelete({ ids: notes.map((x) => x.id), all: true })
                }
              >
                Vaciar papelera
              </TopBarButton>
            </NoteListActions>
          )
        }
      >
        <p className="m-0 -mt-2 mb-1 text-muted-foreground text-ui">
          {`Las notas en la papelera se eliminan definitivamente después de ${TRASH_RETENTION_DAYS} días.`}
        </p>
        <NotesBoardSkeleton loading={isLoading} />
        {loadFailed && (
          <LoadFailedState
            title="No se pudo cargar la papelera"
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        )}
        {!isLoading && !loadFailed && !hasNotes && (
          <EmptyState illustration="trash" title="La papelera está vacía">
            {`Las notas eliminadas permanecen aquí durante ${TRASH_RETENTION_DAYS} días.`}
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
            renderActions={renderActions}
            dateLabel={timeLeft}
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
            key: "restore",
            label: "Restaurar",
            icon: <RotateCcw aria-hidden />,
            onClick: () => restore.mutate(chosenIds),
          },
          {
            key: "forever",
            label: "Eliminar permanentemente",
            icon: <Trash2 aria-hidden />,
            onClick: () => setPendingDelete({ ids: chosenIds }),
          },
        ]}
      />

      <ConfirmationDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete?.all
            ? "¿Vaciar la papelera?"
            : deleteCount === 1
              ? "¿Eliminar esta nota permanentemente?"
              : `¿Eliminar permanentemente ${deleteCount} notas?`
        }
        description={
          pendingDelete?.all
            ? `${deleteCount === 1 ? "1 nota será eliminada" : `${deleteCount} notas serán eliminadas`} de forma permanente. Esta acción no se puede deshacer.`
            : `Esta acción no se puede deshacer. Las personas con las que ${deleteCount === 1 ? "la compartiste" : "las compartiste"} también perderán el acceso.`
        }
        confirmLabel={pendingDelete?.all ? "Vaciar papelera" : "Eliminar permanentemente"}
        busyLabel={pendingDelete?.all ? "Vaciando papelera…" : "Eliminando…"}
        isPending={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </>
  );
}

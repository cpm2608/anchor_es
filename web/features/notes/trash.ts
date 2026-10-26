import { plural } from "@/lib/utils";
import type { Note } from "./types";

export const TRASH_RETENTION_DAYS = 30;

export function deletionDate(note: Note): Date {
  const since = new Date(note.stateChangedAt ?? note.updatedAt);
  return new Date(since.getTime() + TRASH_RETENTION_DAYS * 86400000);
}

export function daysUntilDeletion(note: Note, now = new Date()): number {
  return Math.max(
    1,
    Math.ceil((deletionDate(note).getTime() - now.getTime()) / 86400000),
  );
}

export function deletedNotesText(ownedCount: number, sharedCount: number) {
  if (!sharedCount) return `${ownedCount === 1 ? "Nota enviada" : `${ownedCount} notas enviadas`} a la papelera`;
  if (!ownedCount)
    return `${sharedCount === 1 ? "Nota quitada" : `${sharedCount} notas quitadas`} de tus notas`;
  return `${ownedCount === 1 ? "Nota enviada" : `${ownedCount} notas enviadas`} a la papelera. ${sharedCount} ${sharedCount === 1 ? "quitada" : "quitadas"} de tus notas.`;
}

export function deleteNotesWarning(ownedCount: number, sharedCount: number) {
  const sharedText = `${sharedCount === 1 ? "La nota compartida" : `Las ${sharedCount} notas compartidas`} contigo se quitarán de tus notas. Para volver a verlas, el propietario tendrá que compartirlas de nuevo.`;
  return ownedCount
    ? `${ownedCount === 1 ? "La nota" : `Las ${ownedCount} notas`} se enviarán a la papelera. ${sharedText}`
    : sharedText;
}

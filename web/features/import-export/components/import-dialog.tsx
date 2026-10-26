"use client";

import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileArchive,
  Folder,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { cn, plural } from "@/lib/utils";
import type { PickedFile } from "../adapters/zip";
import { type ImportReport, useImport } from "../hooks/use-import";
import {
  fromDataTransfer,
  fromFileList,
  MAX_PICKED_FILES,
} from "../picked-files";
import type { ImportSkippedItem } from "../types";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** “takeout.zip”, “Obsidian vault” (a folder), or “12 files”. */
function pickedName(files: PickedFile[]) {
  if (files.length === 1) return files[0].file.name;
  const roots = new Set(files.map((f) => f.path.split("/")[0]));
  return roots.size === 1 && files[0].path.includes("/")
    ? [...roots][0]
    : plural(files.length, "file");
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const importer = useImport();
  const [name, setName] = React.useState("");
  const [isFolder, setIsFolder] = React.useState(false);
  const [isTruncated, setIsTruncated] = React.useState(false);

  const close = (next: boolean) => {
    if (!next && importer.isRunning) return;
    if (!next) importer.reset();
    onOpenChange(next);
  };

  const pick = (files: PickedFile[], isDropTruncated = false) => {
    if (!files.length) return;
    setName(pickedName(files));
    setIsFolder(files.length > 1 && files[0].path.includes("/"));
    setIsTruncated(isDropTruncated);
    importer.selectFiles(files);
  };

  const { step, parsed, progress, report } = importer;
  const stopped = step === "running" && !!importer.runError;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        size="md"
        showClose={!importer.isRunning}
        onEscapeKeyDown={(e) => importer.isRunning && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Importar notas</DialogTitle>
          <DialogDescription>
            Importa desde una copia de seguridad de Anchor, una exportación de Google Keep o archivos Markdown.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="gap-3">
          {step === "pick" && (
            <DropArea
              reading={importer.isDetecting}
              name={name}
              error={importer.pickError}
              onFiles={pick}
            />
          )}

          {step === "preview" && parsed && (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3 [&>svg]:size-5.5 [&>svg]:text-muted-foreground">
                {isFolder ? (
                  <Folder aria-hidden />
                ) : (
                  <FileArchive aria-hidden />
                )}
                <div className="grid flex-1 leading-[1.35]">
                  <b className="truncate font-semibold text-ui">{name}</b>
                  <small className="text-muted-foreground text-small">
                    {parsed.formatLabel}
                  </small>
                </div>
                <Button variant="quiet" size="sm" onClick={importer.reset}>
                  Cambiar
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat count={parsed.notes.length} one="nota" many="notas" />
                <Stat count={importer.previewTagCount} one="etiqueta" many="etiquetas" />
                <Stat count={parsed.attachmentCount} one="adjunto" many="adjuntos" />
              </div>
              {isTruncated && (
                <FieldDescription>
                  {`Solo se leyeron los primeros ${MAX_PICKED_FILES.toLocaleString("es-ES")} archivos.`}
                </FieldDescription>
              )}
              {parsed.skipped.length > 0 && (
                <Issues
                  title={`${parsed.skipped.length === 1 ? "1 elemento será omitido" : `${parsed.skipped.length} elementos serán omitidos`}`}
                  items={parsed.skipped}
                />
              )}
              {parsed.formatId === "anchor" && (
                <CheckRow
                  checked={importer.options.skipExisting}
                  onChange={(v) => importer.setOption("skipExisting", v)}
                  label="Omitir notas que ya existan"
                  hint="De lo contrario, se importarán como copias."
                />
              )}
              {parsed.formatId === "markdown" && parsed.hasFolders && (
                <CheckRow
                  checked={importer.options.folderTags}
                  onChange={(v) => importer.setOption("folderTags", v)}
                  label="Usar nombres de carpeta como etiquetas"
                  hint="Las categorías de Nextcloud y carpetas de Obsidian se convierten en etiquetas."
                />
              )}
            </>
          )}

          {step === "running" && (
            <div className="grid gap-2">
              <div className="flex justify-between font-medium text-control tabular-nums">
                <span>
                  {progress?.phase === "attachments"
                    ? `Subiendo archivos adjuntos ${progress.done} de ${progress.total}`
                    : `Importando notas ${progress?.done ?? 0} de ${progress?.total ?? parsed?.notes.length ?? 0}`}
                </span>
                <span>
                  {progress?.total
                    ? Math.round((progress.done / progress.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Importar"
                aria-valuemin={0}
                aria-valuemax={progress?.total ?? 0}
                aria-valuenow={progress?.done ?? 0}
                className="h-1.5 overflow-hidden rounded-xs bg-muted"
              >
                <div
                  className={cn(
                    "h-full rounded-xs bg-accent-strong transition-[width] duration-(--duration-slow) ease-standard",
                    stopped && "bg-muted-foreground",
                  )}
                  style={{
                    width: `${progress?.total ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              {stopped ? (
                <FieldError>{importer.runError}</FieldError>
              ) : (
                <FieldDescription>
                  Mantén esta pestaña abierta hasta que finalice la importación.
                </FieldDescription>
              )}
            </div>
          )}

          {step === "report" && report && <Report report={report} />}
        </DialogBody>
        <DialogFooter>
          {step === "pick" && (
            <Button variant="quiet" onClick={() => close(false)}>
              Cancelar
            </Button>
          )}
          {step === "preview" && parsed && (
            <>
              <Button variant="quiet" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button onClick={importer.start} disabled={!parsed.notes.length}>
                <Upload aria-hidden />
                Importar {parsed.notes.length === 1 ? "1 nota" : `${parsed.notes.length} notas`}
              </Button>
            </>
          )}
          {stopped && (
            <>
              <Button variant="quiet" onClick={() => close(false)}>
                Cerrar
              </Button>
              <Button onClick={importer.retry}>
                <RotateCw aria-hidden />
                Reintentar
              </Button>
            </>
          )}
          {step === "report" && (
            <Button onClick={() => close(false)}>Listo</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropArea({
  reading,
  name,
  error,
  onFiles,
}: {
  reading: boolean;
  name: string;
  error: string | null;
  onFiles: (files: PickedFile[], isTruncated?: boolean) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const errorId = React.useId();
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: a drop area that also opens the file picker */}
      <div
        role="button"
        tabIndex={0}
        aria-busy={reading || undefined}
        aria-describedby={error ? errorId : undefined}
        onClick={() => !reading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !reading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          // Entries must be read before the first await, or the browser clears them.
          void fromDataTransfer(e.dataTransfer).then(
            ({ files, isTruncated }) => {
              // A large folder can still be walking after the dialog closed
              if (isMountedRef.current) onFiles(files, isTruncated);
            },
          );
        }}
        className={cn(
          "grid cursor-pointer justify-items-center gap-2 rounded-2xl border-[1.5px] border-muted-foreground/55 border-dashed px-5 py-8 text-center transition-colors duration-(--duration-hover) hover:bg-foreground/3 hover:not-focus-visible:border-accent-strong hover:[&>svg]:text-accent-strong [&>svg]:size-7.5 [&>svg]:text-muted-foreground [&>svg]:transition-colors [&>svg]:duration-(--duration-hover)",
          dragOver &&
            "border-accent-strong bg-accent/7 [&>svg]:text-accent-strong",
          error &&
            "border-destructive hover:not-focus-visible:border-destructive",
          reading &&
            "cursor-progress border-muted-foreground/30 border-solid bg-foreground/3 hover:not-focus-visible:border-muted-foreground/30 hover:[&>svg]:text-muted-foreground [&>svg]:size-6.5",
        )}
      >
        {reading ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin" />
            <b className="font-semibold text-lead">Leyendo {name}…</b>
            <span className="text-meta text-muted-foreground">
              Las exportaciones grandes pueden tardar unos segundos.
            </span>
          </>
        ) : (
          <>
            <FileArchive aria-hidden />
            <b className="font-semibold text-lead">
              Arrastra un archivo zip o una carpeta aquí
            </b>
            <span className="text-meta text-muted-foreground">
              o haz clic para elegir archivos
            </span>
            <span className="mt-1 flex flex-wrap justify-center gap-1.5">
              <Badge className="bg-foreground/5">Copia de seguridad Anchor</Badge>
              <Badge className="bg-foreground/5">Google Keep</Badge>
              <Badge className="bg-foreground/5">Markdown</Badge>
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".zip,application/zip,.md,.markdown,text/markdown,image/*,audio/*"
          onChange={(e) => {
            const files = fromFileList(e.target.files);
            e.target.value = "";
            onFiles(files);
          }}
        />
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </>
  );
}

function Stat({ count, one, many }: { count: number; one: string; many?: string }) {
  return (
    <div className="grid gap-0.5 rounded-xl px-3.5 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_70%,transparent)]">
      <b className="text-page tabular-nums">{count}</b>
      <span className="text-muted-foreground text-small">
        {count === 1 ? one : (many ?? `${one}s`)}
      </span>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start gap-2.5 text-ui">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-px"
      />
      <label htmlFor={id} className="cursor-pointer">
        {label}
        <small className="mt-0.5 block text-muted-foreground text-small">
          {hint}
        </small>
      </label>
    </div>
  );
}

function Issues({
  title,
  items,
  open,
}: {
  title: string;
  items: ImportSkippedItem[];
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-lg bg-warn text-meta text-warn-foreground"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-semibold [&::-webkit-details-marker]:hidden [&>svg]:size-3.75">
        <TriangleAlert aria-hidden />
        {title}
        <ChevronDown
          aria-hidden
          className="ml-auto transition-transform duration-(--duration-fade) group-open:rotate-180"
        />
      </summary>
      <ul className="m-0 grid max-h-44 gap-1 overflow-auto pr-3 pb-2.5 pl-8">
        {items.map((entry, i) => (
          <li key={i} className="wrap-break-word">
            <b className="font-semibold">{entry.item}</b>: {entry.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Report({ report }: { report: ImportReport }) {
  const issueCount = report.issues.length;
  const imported = report.created + report.remapped;
  const pills = [
    [report.created, "importadas"],
    [report.remapped, "importadas como copias"],
    [report.skipped, "ya existían"],
    [report.failed, "fallaron"],
    [report.attachmentsUploaded, "adjuntos subidos"],
    [report.attachmentsFailed, "adjuntos fallidos"],
  ].filter(([count]) => count) as [number, string][];
  return (
    <>
      <div className="flex items-center gap-2.5 font-semibold text-lead [&>svg]:size-5.5">
        {issueCount ? (
          <TriangleAlert aria-hidden className="text-warn-foreground" />
        ) : imported || report.skipped ? (
          <CircleCheck aria-hidden className="text-added-ink" />
        ) : (
          <CircleAlert aria-hidden className="text-muted-foreground" />
        )}
        {imported || report.skipped
          ? `${imported === 1 ? "1 nota importada" : `${imported} notas importadas`}${issueCount ? `, ${issueCount} ${issueCount === 1 ? "requiere" : "requieren"} atención` : ""}`
          : "No se importó nada"}
      </div>
      {pills.length > 1 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {pills.map(([count, label]) => (
            <li
              key={label}
              className="rounded-pill bg-muted px-2.5 py-1 text-meta text-muted-foreground"
            >
              <b className="font-semibold text-foreground tabular-nums">
                {count}
              </b>{" "}
              {label}
            </li>
          ))}
        </ul>
      )}
      {issueCount > 0 && (
        <Issues
          title={`${issueCount === 1 ? "1 elemento requiere" : `${issueCount} elementos requieren`} atención`}
          items={report.issues}
          open
        />
      )}
      {report.restoredTrashed && (
        <FieldDescription>
          Las notas restauradas a la papelera tendrán 30 días a partir de ahora.
        </FieldDescription>
      )}
    </>
  );
}

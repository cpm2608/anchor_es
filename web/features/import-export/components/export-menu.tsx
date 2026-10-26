"use client";

import { ChevronDown, Download, FileText, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { downloadExport } from "../api";
import type { ExportFormat } from "../types";

const CHOICES = [
  {
    format: "anchor",
    label: "Copia de seguridad Anchor (.zip)",
    hint: "Todo, para restaurar luego: notas, etiquetas y adjuntos",
    icon: FolderArchive,
  },
  {
    format: "markdown",
    label: "Archivos Markdown (.zip)",
    hint: "Archivos .md para Obsidian, Nextcloud Notes y otros",
    icon: FileText,
  },
] as const;

function startExport(format: ExportFormat) {
  void toast
    .promise(downloadExport(format), {
      loading: "Preparando tu exportación…",
      success: "Exportación descargada",
      error: "No se pudieron exportar tus notas",
      retry: () => startExport(format),
    })
    .catch(() => {});
}

export function ExportMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Download aria-hidden />
          Exportar
          <ChevronDown aria-hidden className="-mr-1 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {CHOICES.map((choice) => (
          <DropdownMenuItem
            key={choice.format}
            className="items-start py-2 [&>svg]:mt-0.5"
            onSelect={() => startExport(choice.format)}
          >
            <choice.icon />
            <span className="grid gap-0.5 whitespace-normal leading-[1.35]">
              {choice.label}
              <small className="text-muted-foreground text-small">
                {choice.hint}
              </small>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Upload } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ExportMenu, ImportDialog } from "@/features/import-export";
import { Row, RowText, Section } from "./settings-blocks";

export function ImportExportSection() {
  const [importing, setImporting] = React.useState(false);
  return (
    <Section id="data" title="Importar y exportar">
      <Row>
        <RowText
          title="Exportar"
          text="Descarga todas tus notas como copia de seguridad o para moverlas a otra aplicación."
        />
        <ExportMenu />
      </Row>
      <Row>
        <RowText
          title="Importar"
          text="Importa desde una copia de seguridad de Anchor, Google Keep, o archivos Markdown de Obsidian y Nextcloud Notes."
        />
        <Button variant="secondary" onClick={() => setImporting(true)}>
          <Upload aria-hidden />
          Importar
        </Button>
      </Row>
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </Section>
  );
}

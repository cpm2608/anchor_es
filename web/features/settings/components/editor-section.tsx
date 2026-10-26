"use client";

import { Switch } from "@/components/ui/switch";
import { usePreferencesStore } from "@/features/preferences";
import {
  Row,
  RowText,
  SaveStatus,
  Section,
  useSaveStatus,
} from "./settings-blocks";

export function EditorSection() {
  const { editor, setEditorPreference } = usePreferencesStore();
  const [saveStatus, setSaveStatus] = useSaveStatus();
  return (
    <Section id="editor" title="Editor">
      <Row>
        <RowText
          title={
            <label htmlFor="sort-checked">
              Mover elementos completados al final
            </label>
          }
          text="Los elementos marcados se mueven automáticamente debajo de los no marcados."
          saved={<SaveStatus state={saveStatus} />}
        />
        <Switch
          id="sort-checked"
          checked={editor.sortChecklistItems}
          onCheckedChange={(on) => {
            setEditorPreference("sortChecklistItems", on);
            setSaveStatus("saved");
          }}
        />
      </Row>
    </Section>
  );
}

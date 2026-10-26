"use client";

import {
  ALargeSmall,
  CalendarPlus,
  Check,
  LayoutDashboard,
  LayoutGrid,
  PencilLine,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import { TopBarButton } from "@/components/layout/app-page";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SortBy, SortOrder, ViewMode } from "@/features/preferences";
import { useRovingFocus } from "@/lib/hooks/use-roving-focus";
import { cn } from "@/lib/utils";

interface ViewOptionsProps {
  layout: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onLayout: (layout: ViewMode) => void;
  onSort: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

const ORDER_OPTIONS: Record<SortBy, [SortOrder, string][]> = {
  updatedAt: [
    ["desc", "Más recientes primero"],
    ["asc", "Más antiguos primero"],
  ],
  createdAt: [
    ["desc", "Más recientes primero"],
    ["asc", "Más antiguos primero"],
  ],
  title: [
    ["asc", "De la A a la Z"],
    ["desc", "De la Z a la A"],
  ],
};

const headingClass = "m-0 mb-2 text-label text-muted-foreground uppercase";

export function ViewOptions({
  layout,
  sortBy,
  sortOrder,
  onLayout,
  onSort,
}: ViewOptionsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <TopBarButton icon={<SlidersHorizontal aria-hidden />}>
          Vista
        </TopBarButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Opciones de vista"
        className="grid w-68 gap-3 p-3"
      >
        <div>
          <h2 className={headingClass}>Diseño</h2>
          <SegmentedControl
            variant="tiles"
            aria-label="Diseño"
            value={layout}
            onValueChange={onLayout}
            options={[
              {
                value: "masonry",
                label: "Mosaico",
                icon: <LayoutDashboard aria-hidden />,
              },
              {
                value: "grid",
                label: "Cuadrícula",
                icon: <LayoutGrid aria-hidden />,
              },
              { value: "list", label: "Lista", icon: <Rows3 aria-hidden /> },
            ]}
          />
        </div>
        <div>
          <h2 className={headingClass} id="sort-by">
            Ordenar por
          </h2>
          <SortChoices sortBy={sortBy} onSort={onSort} />
        </div>
        <SegmentedControl
          full
          aria-label="Orden"
          value={sortOrder}
          onValueChange={(order) => onSort(sortBy, order)}
          options={ORDER_OPTIONS[sortBy].map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </PopoverContent>
    </Popover>
  );
}

const SORT_CHOICES = [
  ["updatedAt", "Última edición", PencilLine],
  ["createdAt", "Fecha de creación", CalendarPlus],
  ["title", "Título", ALargeSmall],
] as const;

function SortChoices({
  sortBy,
  onSort,
}: Pick<ViewOptionsProps, "sortBy" | "onSort">) {
  const roving = useRovingFocus<HTMLDivElement>({
    orientation: "both",
    selectsOnMove: true,
  });
  return (
    <div
      ref={roving.ref}
      role="radiogroup"
      aria-labelledby="sort-by"
      onFocus={roving.onFocus}
      onKeyDown={roving.onKeyDown}
      className="grid gap-px"
    >
      {SORT_CHOICES.map(([value, label, Icon]) => {
        const selected = sortBy === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: menu-style rows in a radio group
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() =>
              !selected && onSort(value, value === "title" ? "asc" : "desc")
            }
            className={cn(
              "relative flex h-8.5 cursor-pointer items-center gap-2.5 rounded-menu-item border-0 bg-transparent px-2.5 text-left text-ui hover:bg-foreground/6 focus-visible:bg-foreground/6 focus-visible:outline-transparent focus-visible:after:absolute focus-visible:after:top-1/2 focus-visible:after:left-0.75 focus-visible:after:-mt-2 focus-visible:after:h-4 focus-visible:after:w-0.75 focus-visible:after:rounded-xs focus-visible:after:bg-accent-strong focus-visible:after:content-[''] [&>svg]:size-4 [&>svg]:text-muted-foreground",
              selected && "font-semibold",
            )}
          >
            <Icon aria-hidden />
            {label}
            {selected && (
              <Check aria-hidden className="ml-auto text-accent-strong!" />
            )}
          </button>
        );
      })}
    </div>
  );
}

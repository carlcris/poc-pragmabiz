"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronsUpDown,
  Download,
  Eraser,
  Loader2,
  MoveHorizontal,
  MoveVertical,
  Package,
  RotateCcw,
  RotateCw,
  Save,
  ScissorsLineDashed,
  Shapes,
} from "lucide-react";
import { useCreateTransformationTemplate } from "@/hooks/useTransformationTemplates";
import { useItemsStock } from "@/hooks/useItemsStock";
import { useWarehouses } from "@/hooks/useWarehouses";
import { itemsApi } from "@/lib/api/items";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { toast } from "sonner";
import type { ItemDimensions } from "@/types/item";
import type {
  CreateTransformationTemplateRequest,
  SheetLayoutMappedItem,
  SheetLayoutSourceItem,
  SheetLayoutSection,
  SheetLayoutSectionType,
  SheetLayoutUnit,
} from "@/types/transformation-template";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SplitOrientation = "vertical" | "horizontal";
type InteractionMode = "draw" | "slice";

type DragState = {
  sectionId: string;
  orientation: SplitOrientation;
  cursorX: number;
  cursorY: number;
};

type MergeableCut = {
  id: string;
  orientation: SplitOrientation;
  a: SheetLayoutSection;
  b: SheetLayoutSection;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ContextMenuState = {
  x: number;
  y: number;
  sectionId: string;
};

type ItemPickerState = {
  mode: "parent" | "piece" | "slice";
  sectionId?: string;
};

type SliceClipboard = {
  width: number;
  height: number;
  mappedItem: SheetLayoutMappedItem | null;
};

type SliceDialogSelection = {
  mappedItem: SheetLayoutMappedItem;
  width: number;
  height: number;
};

const getItemPickerTitle = (mode: ItemPickerState["mode"]) =>
  mode === "parent"
    ? "Select Parent Sheet Item"
    : mode === "slice"
      ? "Select Slice Item"
      : "Map Piece to Item";

const getItemPickerDescription = (mode: ItemPickerState["mode"], sectionLabel?: string | null) =>
  mode === "parent"
    ? "Choose a warehouse item with stored dimensions to use as the parent sheet."
    : mode === "slice"
      ? `Search warehouse items to assign to the new slice in ${sectionLabel || "the selected section"}.`
      : `Search warehouse items to map ${sectionLabel || "the selected piece"}.`;

const DEFAULT_SHEET_WIDTH = 72;
const DEFAULT_SHEET_HEIGHT = 48;
const MIN_SECTION_SIZE = 2;
const EDGE_EPSILON = 0.0001;
const ROOT_SECTION_ID = "sheet-root";
const CONTEXT_MENU_WIDTH = 224;
const CONTEXT_MENU_OFFSET = 8;
const CONTEXT_MENU_SAFE_MARGIN = 20;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const isClose = (a: number, b: number) => Math.abs(a - b) < EDGE_EPSILON;

const getContextMenuPosition = (x: number, y: number) => {
  if (typeof window === "undefined") {
    return { x, y };
  }

  return {
    x: clamp(
      x,
      CONTEXT_MENU_OFFSET,
      window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_SAFE_MARGIN
    ),
    y,
  };
};

const parseItemDimensions = (
  dimensions: ItemDimensions | null | undefined
): { width: number; height: number; unit: SheetLayoutUnit | null } | null => {
  if (!dimensions) return null;

  const width = Number(dimensions.width ?? dimensions.length ?? 0);
  const height = Number(dimensions.height ?? 0);
  const dimensionUnit = dimensions.unit;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    unit:
      dimensionUnit === "cm" || dimensionUnit === "mm" || dimensionUnit === "in"
        ? dimensionUnit
        : null,
  };
};

const relabelSections = (sections: SheetLayoutSection[]) => {
  const sorted = [...sections].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  let pieceCount = 0;
  let leftoverCount = 0;

  return sorted.map((section, index) => {
    const label = section.type === "piece" ? `P${++pieceCount}` : `L${++leftoverCount}`;
    return {
      ...section,
      label,
      order: index + 1,
    };
  });
};

const createInitialSections = (width: number, height: number): SheetLayoutSection[] =>
  relabelSections([
    {
      id: ROOT_SECTION_ID,
      x: 0,
      y: 0,
      width,
      height,
      label: "L1",
      order: 1,
      type: "leftover",
    },
  ]);

const buildSplitSections = (
  section: SheetLayoutSection,
  orientation: SplitOrientation,
  cursorX: number,
  cursorY: number
) => {
  const nextType: SheetLayoutSectionType = "piece";

  if (orientation === "vertical") {
    const splitX = clamp(
      cursorX,
      section.x + MIN_SECTION_SIZE,
      section.x + section.width - MIN_SECTION_SIZE
    );
    return [
      {
        ...section,
        id: crypto.randomUUID(),
        width: splitX - section.x,
        type: nextType,
        mappedItem: null,
      },
      {
        ...section,
        id: crypto.randomUUID(),
        x: splitX,
        width: section.x + section.width - splitX,
        type: nextType,
        mappedItem: null,
      },
    ];
  }

  const splitY = clamp(
    cursorY,
    section.y + MIN_SECTION_SIZE,
    section.y + section.height - MIN_SECTION_SIZE
  );
  return [
    {
      ...section,
      id: crypto.randomUUID(),
      height: splitY - section.y,
      type: nextType,
      mappedItem: null,
    },
    {
      ...section,
      id: crypto.randomUUID(),
      y: splitY,
      height: section.y + section.height - splitY,
      type: nextType,
      mappedItem: null,
    },
  ];
};

const buildSliceSections = (
  section: SheetLayoutSection,
  sliceWidth: number,
  sliceHeight: number
): SheetLayoutSection[] => {
  const boundedWidth = clamp(sliceWidth, MIN_SECTION_SIZE, section.width);
  const boundedHeight = clamp(sliceHeight, MIN_SECTION_SIZE, section.height);

  const nextSections: SheetLayoutSection[] = [
    {
      ...section,
      id: crypto.randomUUID(),
      width: boundedWidth,
      height: boundedHeight,
      type: "piece",
      mappedItem: null,
    },
  ];

  const remainingWidth = section.width - boundedWidth;
  const remainingHeight = section.height - boundedHeight;

  if (remainingWidth >= MIN_SECTION_SIZE) {
    nextSections.push({
      ...section,
      id: crypto.randomUUID(),
      x: section.x + boundedWidth,
      width: remainingWidth,
      height: boundedHeight,
      type: "leftover",
      mappedItem: null,
    });
  }

  if (remainingHeight >= MIN_SECTION_SIZE) {
    nextSections.push({
      ...section,
      id: crypto.randomUUID(),
      y: section.y + boundedHeight,
      width: section.width,
      height: remainingHeight,
      type: "leftover",
      mappedItem: null,
    });
  }

  return nextSections;
};

const buildMergeableCuts = (sections: SheetLayoutSection[]): MergeableCut[] => {
  const cuts: MergeableCut[] = [];

  for (let index = 0; index < sections.length; index += 1) {
    const current = sections[index];

    for (let compareIndex = index + 1; compareIndex < sections.length; compareIndex += 1) {
      const candidate = sections[compareIndex];

      const sharesVerticalBoundary =
        isClose(current.x + current.width, candidate.x) ||
        isClose(candidate.x + candidate.width, current.x);
      const sharesHorizontalBoundary =
        isClose(current.y + current.height, candidate.y) ||
        isClose(candidate.y + candidate.height, current.y);

      if (
        sharesVerticalBoundary &&
        isClose(current.y, candidate.y) &&
        isClose(current.height, candidate.height)
      ) {
        const x = isClose(current.x + current.width, candidate.x) ? candidate.x : current.x;
        cuts.push({
          id: [current.id, candidate.id].sort().join(":"),
          orientation: "vertical",
          a: current,
          b: candidate,
          x1: x,
          y1: current.y,
          x2: x,
          y2: current.y + current.height,
        });
      }

      if (
        sharesHorizontalBoundary &&
        isClose(current.x, candidate.x) &&
        isClose(current.width, candidate.width)
      ) {
        const y = isClose(current.y + current.height, candidate.y) ? candidate.y : current.y;
        cuts.push({
          id: [current.id, candidate.id].sort().join(":"),
          orientation: "horizontal",
          a: current,
          b: candidate,
          x1: current.x,
          y1: y,
          x2: current.x + current.width,
          y2: y,
        });
      }
    }
  }

  return cuts;
};

const getSectionTextLayout = (section: SheetLayoutSection) => {
  const titleFontSize = 1.05;
  const dimensionFontSize = 0.72;
  const canShowDimensions = section.width >= 8 && section.height >= 6;
  const canShowTitle = section.width >= 3 && section.height >= 3;
  const canShowMappedItem = section.width >= 8 && section.height >= 6;

  return {
    canShowTitle,
    canShowDimensions,
    canShowMappedItem,
    titleFontSize,
    dimensionFontSize,
  };
};

const wrapSvgText = (
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string[] => {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length === maxLines) {
        break;
      }
      currentLine = word;
      continue;
    }

    lines.push(word.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd());
    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (words.length > 0 && lines.length) {
    const usedWords = lines.join(" ").split(" ").length;
    if (usedWords < words.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}…`;
    }
  }

  return lines.slice(0, maxLines);
};

export function TransformationTemplateDesignerPage() {
  const router = useRouter();
  const createTemplate = useCreateTransformationTemplate();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  const [templateName, setTemplateName] = useState("");
  const [sheetWidthInput, setSheetWidthInput] = useState(String(DEFAULT_SHEET_WIDTH));
  const [sheetHeightInput, setSheetHeightInput] = useState(String(DEFAULT_SHEET_HEIGHT));
  const [sheetWidth, setSheetWidth] = useState(DEFAULT_SHEET_WIDTH);
  const [sheetHeight, setSheetHeight] = useState(DEFAULT_SHEET_HEIGHT);
  const [sheetUnit, setSheetUnit] = useState<SheetLayoutUnit>("in");
  const [sliceWidthInput, setSliceWidthInput] = useState("");
  const [sliceHeightInput, setSliceHeightInput] = useState("");
  const [sections, setSections] = useState<SheetLayoutSection[]>(() =>
    createInitialSections(DEFAULT_SHEET_WIDTH, DEFAULT_SHEET_HEIGHT)
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("draw");
  const [splitOrientation, setSplitOrientation] = useState<SplitOrientation>("vertical");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [history, setHistory] = useState<SheetLayoutSection[][]>([]);
  const [future, setFuture] = useState<SheetLayoutSection[][]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sliceDialogOpen, setSliceDialogOpen] = useState(false);
  const [sliceDialogError, setSliceDialogError] = useState<string | null>(null);
  const [sliceDialogSelection, setSliceDialogSelection] = useState<SliceDialogSelection | null>(null);
  const [sliceItemOpen, setSliceItemOpen] = useState(false);
  const [sliceItemSearchInput, setSliceItemSearchInput] = useState("");
  const [sliceItemSearch, setSliceItemSearch] = useState("");
  const [itemPickerState, setItemPickerState] = useState<ItemPickerState | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemPickerError, setItemPickerError] = useState<string | null>(null);
  const [parentSheetItem, setParentSheetItem] = useState<SheetLayoutSourceItem | null>(null);
  const [isSelectingItem, setIsSelectingItem] = useState(false);
  const [recentlyMappedSectionId, setRecentlyMappedSectionId] = useState<string | null>(null);
  const [sliceClipboard, setSliceClipboard] = useState<SliceClipboard | null>(null);

  const { data: warehousesResponse } = useWarehouses({ limit: 50 });
  const currentWarehouse =
    warehousesResponse?.data.find(
      (warehouse) => warehouse.businessUnitId === currentBusinessUnit?.id
    ) ?? null;
  const warehouseId = currentWarehouse?.id;

  const { data: itemCandidatesResponse, isLoading: isLoadingItemCandidates } = useItemsStock({
    warehouseId,
    search: itemSearch || undefined,
    page: 1,
    limit: 20,
  });
  const {
    data: sliceItemCandidatesResponse,
    isLoading: isLoadingSliceItemCandidates,
    isFetching: isFetchingSliceItemCandidates,
  } = useItemsStock({
    warehouseId,
    search: sliceItemSearch || undefined,
    page: 1,
    limit: 5,
  });

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );
  const mergeableCuts = useMemo(() => buildMergeableCuts(sections), [sections]);
  const selectedCut = useMemo(
    () => mergeableCuts.find((cut) => cut.id === selectedCutId) ?? null,
    [mergeableCuts, selectedCutId]
  );
  const selectedContextSection = useMemo(
    () => sections.find((section) => section.id === itemPickerState?.sectionId) ?? null,
    [itemPickerState?.sectionId, sections]
  );
  const pieceSections = useMemo(
    () => sections.filter((section) => section.type === "piece"),
    [sections]
  );
  const unmappedPieceSections = useMemo(
    () => pieceSections.filter((section) => !section.mappedItem),
    [pieceSections]
  );
  const isCanvasLocked = !parentSheetItem;
  const effectiveSliceWidthInput =
    sliceWidthInput.trim() !== ""
      ? sliceWidthInput
      : sliceDialogSelection
        ? String(sliceDialogSelection.width)
        : "";
  const effectiveSliceHeightInput =
    sliceHeightInput.trim() !== ""
      ? sliceHeightInput
      : sliceDialogSelection
        ? String(sliceDialogSelection.height)
        : "";

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("blur", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    const rect = contextMenuRef.current.getBoundingClientRect();
    const nextX = clamp(
      contextMenu.x,
      CONTEXT_MENU_OFFSET,
      window.innerWidth - rect.width - CONTEXT_MENU_SAFE_MARGIN
    );
    const nextY = clamp(
      contextMenu.y,
      CONTEXT_MENU_OFFSET,
      window.innerHeight - rect.height - CONTEXT_MENU_SAFE_MARGIN
    );

    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((current) =>
        current
          ? {
              ...current,
              x: nextX,
              y: nextY,
            }
          : current
      );
    }
  }, [contextMenu]);

  useEffect(() => {
    const trimmed = sliceItemSearchInput.trim();

    if (trimmed.length === 0) {
      setSliceItemSearch("");
      return;
    }

    if (trimmed.length < 3) {
      setSliceItemSearch("");
      return;
    }

    const timer = window.setTimeout(() => {
      setSliceItemSearch(trimmed);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [sliceItemSearchInput]);

  useEffect(() => {
    if (!sliceItemOpen) {
      setSliceItemSearchInput("");
      setSliceItemSearch("");
    }
  }, [sliceItemOpen]);

  useEffect(() => {
    if (!sliceDialogOpen || !sliceDialogSelection) return;
    setSliceWidthInput(String(sliceDialogSelection.width));
    setSliceHeightInput(String(sliceDialogSelection.height));
  }, [sliceDialogOpen, sliceDialogSelection]);

  const commitSections = (nextSections: SheetLayoutSection[]) => {
    setHistory((current) => [...current, sections]);
    setFuture([]);
    setSections(relabelSections(nextSections));
    setSelectedCutId(null);
    setContextMenu(null);
  };

  const resetLayoutToSheet = (width: number, height: number, unit: SheetLayoutUnit) => {
    setSheetWidthInput(String(width));
    setSheetHeightInput(String(height));
    setSheetWidth(width);
    setSheetHeight(height);
    setSheetUnit(unit);
    setHistory([]);
    setFuture([]);
    setSections(createInitialSections(width, height));
    setSelectedSectionId(null);
    setSelectedCutId(null);
    setSliceWidthInput("");
    setSliceHeightInput("");
    setDragState(null);
  };

  const openItemPicker = (state: ItemPickerState) => {
    setItemPickerState(state);
    setItemSearch("");
    setItemPickerError(null);
    setContextMenu(null);
  };

  const closeItemPicker = () => {
    setItemPickerState(null);
    setItemSearch("");
    setItemPickerError(null);
    setIsSelectingItem(false);
  };

  const closeSliceDialog = () => {
    setSliceDialogError(null);
    setSliceDialogOpen(false);
    setSliceDialogSelection(null);
    setSliceItemOpen(false);
    setSliceItemSearchInput("");
    setSliceItemSearch("");
  };

  const handleApplySheetSize = () => {
    const parsedWidth = Number(sheetWidthInput);
    const parsedHeight = Number(sheetHeightInput);

    if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
      setErrorMessage("Parent sheet width must be greater than zero.");
      return;
    }

    if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      setErrorMessage("Parent sheet height must be greater than zero.");
      return;
    }

    setErrorMessage(null);
    setParentSheetItem(null);
    resetLayoutToSheet(parsedWidth, parsedHeight, sheetUnit);
  };

  const handleUndo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((current) => [sections, ...current]);
    setHistory((current) => current.slice(0, -1));
    setSections(previous);
    setSelectedSectionId(null);
    setSelectedCutId(null);
    setDragState(null);
  };

  const handleRedo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, sections]);
    setFuture((current) => current.slice(1));
    setSections(next);
    setSelectedSectionId(null);
    setSelectedCutId(null);
    setDragState(null);
  };

  const handleReset = () => {
    setErrorMessage(null);
    commitSections(createInitialSections(sheetWidth, sheetHeight));
    setSelectedSectionId(null);
    setSelectedCutId(null);
    setDragState(null);
  };

  const toggleSelectedSectionType = (type: SheetLayoutSectionType) => {
    if (!selectedSection || selectedSection.type === type) return;

    const nextSections = sections.map((section) =>
      section.id === selectedSection.id
        ? { ...section, type, mappedItem: type === "piece" ? section.mappedItem ?? null : null }
        : section
    );
    commitSections(nextSections);
  };

  const applySliceToSection = (
    targetSection: SheetLayoutSection,
    sliceWidth: number,
    sliceHeight: number,
    mappedItem?: SheetLayoutMappedItem | null
  ) => {
    if (!Number.isFinite(sliceWidth) || sliceWidth <= 0) {
      return { ok: false as const, error: "Slice width must be greater than zero." };
    }

    if (!Number.isFinite(sliceHeight) || sliceHeight <= 0) {
      return { ok: false as const, error: "Slice height must be greater than zero." };
    }

    if (sliceWidth > targetSection.width || sliceHeight > targetSection.height) {
      return { ok: false as const, error: "Slice dimensions must fit within the selected section." };
    }

    const nextSliceSections = buildSliceSections(targetSection, sliceWidth, sliceHeight);
    if (nextSliceSections[0]) {
      nextSliceSections[0] = {
        ...nextSliceSections[0],
        mappedItem: mappedItem ?? null,
      };
    }
    const nextSections = sections.flatMap((section) =>
      section.id === targetSection.id ? nextSliceSections : [section]
    );

    setErrorMessage(null);
    commitSections(nextSections);
    setSelectedSectionId(nextSliceSections[0]?.id ?? null);
    return { ok: true as const };
  };

  const handlePlotSlice = () => {
    if (!selectedSection) {
      setErrorMessage("Select a section before plotting a slice.");
      return;
    }

    const sliceWidth = Number(effectiveSliceWidthInput);
    const sliceHeight = Number(effectiveSliceHeightInput);
    const result = applySliceToSection(selectedSection, sliceWidth, sliceHeight);
    if (!result.ok) {
      setErrorMessage(result.error);
    }
  };

  const getSvgPoint = (event: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: ((event.clientX - rect.left) / rect.width) * sheetWidth,
      y: ((event.clientY - rect.top) / rect.height) * sheetHeight,
    };
  };

  const handleSectionPointerDown = (
    section: SheetLayoutSection,
    event: React.PointerEvent<SVGRectElement>
  ) => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (interactionMode !== "draw") {
      setSelectedSectionId(section.id);
      setSelectedCutId(null);
      setErrorMessage(null);
      return;
    }

    const point = getSvgPoint(event);
    if (!point) return;

    setErrorMessage(null);
    setSelectedSectionId(section.id);
    setSelectedCutId(null);
    setDragState({
      sectionId: section.id,
      orientation: splitOrientation,
      cursorX: point.x,
      cursorY: point.y,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isCanvasLocked) return;
    if (interactionMode !== "draw") return;
    if (!dragState) return;
    const point = getSvgPoint(event);
    if (!point) return;

    setDragState((current) =>
      current
        ? {
            ...current,
            cursorX: point.x,
            cursorY: point.y,
          }
        : current
    );
  };

  const handlePointerUp = () => {
    if (isCanvasLocked) {
      setDragState(null);
      return;
    }

    if (interactionMode !== "draw") {
      setDragState(null);
      return;
    }

    if (!dragState) return;

    const targetSection = sections.find((section) => section.id === dragState.sectionId);
    if (!targetSection) {
      setDragState(null);
      return;
    }

    const nextSplitSections = buildSplitSections(
      targetSection,
      dragState.orientation,
      dragState.cursorX,
      dragState.cursorY
    );

    if (
      nextSplitSections.some(
        (section) => section.width < MIN_SECTION_SIZE || section.height < MIN_SECTION_SIZE
      )
    ) {
      setDragState(null);
      return;
    }

    const nextSections = sections.flatMap((section) =>
      section.id === targetSection.id ? nextSplitSections : [section]
    );

    commitSections(nextSections);
    setSelectedSectionId(nextSplitSections[0]?.id ?? null);
    setDragState(null);
  };

  const handleSelectCut = (cutId: string) => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    setSelectedSectionId(null);
    setSelectedCutId(cutId);
    setErrorMessage(null);
  };

  const handleSectionContextMenu = (
    section: SheetLayoutSection,
    event: React.MouseEvent<SVGRectElement>
  ) => {
    event.preventDefault();
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    const position = getContextMenuPosition(event.clientX, event.clientY);
    setSelectedSectionId(section.id);
    setSelectedCutId(null);
    setContextMenu({
      x: position.x,
      y: position.y,
      sectionId: section.id,
    });
    setErrorMessage(null);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      setContextMenu(null);
      return;
    }

    const sectionElement = target.closest("[data-section-id]");
    const sectionId = sectionElement?.getAttribute("data-section-id") ?? null;
    const fallbackSection =
      sections.length === 1 && sections[0]
        ? sections[0]
        : sections.find((item) => item.id === selectedSectionId) ?? null;
    const section =
      (sectionId ? sections.find((item) => item.id === sectionId) : null) ?? fallbackSection;

    if (!section) {
      setContextMenu(null);
      setErrorMessage("Right-click a section to open canvas actions.");
      return;
    }

    const position = getContextMenuPosition(event.clientX, event.clientY);
    setSelectedSectionId(section.id);
    setSelectedCutId(null);
    setContextMenu({
      x: position.x,
      y: position.y,
      sectionId: section.id,
    });
    setErrorMessage(null);
  };

  const handleContextDrawCut = (orientation: SplitOrientation) => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    setInteractionMode("draw");
    setSplitOrientation(orientation);
    setDragState(null);
    setContextMenu(null);
    setErrorMessage("Drag inside the selected section to place the cut.");
  };

  const handleContextSelectSection = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection) {
      setContextMenu(null);
      return;
    }

    setSelectedSectionId(selectedSection.id);
    setSelectedCutId(null);
    setContextMenu(null);
    setErrorMessage(null);
  };

  const handleContextAddSlice = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    setInteractionMode("slice");
    setSliceDialogError(null);
    setSliceDialogSelection(null);
    setSliceDialogOpen(true);
    setContextMenu(null);
  };

  const handleContextMapItem = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection || selectedSection.type !== "piece") {
      setContextMenu(null);
      return;
    }
    openItemPicker({ mode: "piece", sectionId: selectedSection.id });
  };

  const handleContextCopySlice = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection) {
      setContextMenu(null);
      return;
    }

    setSliceClipboard({
      width: selectedSection.width,
      height: selectedSection.height,
      mappedItem: selectedSection.type === "piece" ? selectedSection.mappedItem ?? null : null,
    });
    setContextMenu(null);
    toast.success(`Copied ${selectedSection.label} slice`);
  };

  const handleContextPasteSlice = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection || !sliceClipboard) {
      setContextMenu(null);
      return;
    }

    const result = applySliceToSection(
      selectedSection,
      sliceClipboard.width,
      sliceClipboard.height,
      sliceClipboard.mappedItem
    );

    if (!result.ok) {
      setErrorMessage(result.error);
      toast.error(result.error);
      return;
    }

    setInteractionMode("slice");
    setContextMenu(null);
    toast.success(`Pasted ${sliceClipboard.width.toFixed(2)} x ${sliceClipboard.height.toFixed(2)} slice`);
  };

  const handleContextDeleteSection = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection || selectedSection.type !== "piece") {
      setContextMenu(null);
      return;
    }

    const nextSections = sections.map((section) =>
      section.id === selectedSection.id
        ? { ...section, type: "leftover" as const, mappedItem: null }
        : section
    );
    commitSections(nextSections);
  };

  const handleContextMarkLeftover = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedSection || selectedSection.type === "leftover") {
      setContextMenu(null);
      return;
    }

    const nextSections = sections.map((section) =>
      section.id === selectedSection.id
        ? { ...section, type: "leftover" as const, mappedItem: null }
        : section
    );
    commitSections(nextSections);
  };

  const handleDeleteSelectedCut = () => {
    if (isCanvasLocked) {
      setErrorMessage("Select a parent sheet item before editing the layout.");
      return;
    }
    if (!selectedCut) return;

    const mergedSection: SheetLayoutSection = {
      id: crypto.randomUUID(),
      x: Math.min(selectedCut.a.x, selectedCut.b.x),
      y: Math.min(selectedCut.a.y, selectedCut.b.y),
      width:
        selectedCut.orientation === "vertical"
          ? selectedCut.a.width + selectedCut.b.width
          : selectedCut.a.width,
      height:
        selectedCut.orientation === "horizontal"
          ? selectedCut.a.height + selectedCut.b.height
          : selectedCut.a.height,
      label: "",
      order: 0,
      type: selectedCut.a.type === selectedCut.b.type ? selectedCut.a.type : "leftover",
    };

    const nextSections = sections
      .filter((section) => section.id !== selectedCut.a.id && section.id !== selectedCut.b.id)
      .concat(mergedSection);

    commitSections(nextSections);
    setSelectedSectionId(mergedSection.id);
  };

  const dragMeasurement = useMemo(() => {
    if (!dragState) return null;

    const targetSection = sections.find((section) => section.id === dragState.sectionId);
    if (!targetSection) return null;

    if (dragState.orientation === "vertical") {
      const splitX = clamp(
        dragState.cursorX,
        targetSection.x + MIN_SECTION_SIZE,
        targetSection.x + targetSection.width - MIN_SECTION_SIZE
      );
      const leftWidth = splitX - targetSection.x;
      return {
        cursorX: dragState.cursorX,
        cursorY: dragState.cursorY,
        guide: {
          x1: splitX,
          y1: targetSection.y,
          x2: splitX,
          y2: targetSection.y + targetSection.height,
        },
        text: `${leftWidth.toFixed(2)} x ${targetSection.height.toFixed(2)} ${sheetUnit}`,
      };
    }

    const splitY = clamp(
      dragState.cursorY,
      targetSection.y + MIN_SECTION_SIZE,
      targetSection.y + targetSection.height - MIN_SECTION_SIZE
    );
    const topHeight = splitY - targetSection.y;
    return {
      cursorX: dragState.cursorX,
      cursorY: dragState.cursorY,
      guide: {
        x1: targetSection.x,
        y1: splitY,
        x2: targetSection.x + targetSection.width,
        y2: splitY,
      },
      text: `${targetSection.width.toFixed(2)} x ${topHeight.toFixed(2)} ${sheetUnit}`,
    };
  }, [dragState, sections, sheetUnit]);

  const handleOpenParentSheetPicker = () => {
    if (!warehouseId) {
      setErrorMessage("No warehouse is available for the current business unit.");
      return;
    }

    openItemPicker({ mode: "parent" });
  };

  const handleSelectSliceItem = async (item: {
    id: string;
    code: string;
    name: string;
    uomId: string;
    uom: string;
  }) => {
    setSliceDialogError(null);
    setIsSelectingItem(true);

    try {
      const itemResponse = await itemsApi.getItem(item.id);
      const parsedDimensions = parseItemDimensions(itemResponse.data.dimensions);

      if (!parsedDimensions) {
        setSliceDialogError("The selected item does not have valid width and height dimensions.");
        return;
      }

      if (parsedDimensions.unit && parsedDimensions.unit !== sheetUnit) {
        setSliceDialogError(
          `The selected item uses ${parsedDimensions.unit}. Adjust the parent sheet unit to match before using it for a slice.`
        );
        return;
      }

      setSliceDialogSelection({
        mappedItem: {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          uomId: item.uomId,
          uomCode: item.uom,
        },
        width: parsedDimensions.width,
        height: parsedDimensions.height,
      });
      setSliceWidthInput(String(parsedDimensions.width));
      setSliceHeightInput(String(parsedDimensions.height));
      setSliceItemOpen(false);
    } catch (error) {
      setSliceDialogError(
        error instanceof Error ? error.message : "Failed to load the selected slice item."
      );
    } finally {
      setIsSelectingItem(false);
    }
  };

  const handleSelectCandidateItem = async (item: {
    id: string;
    code: string;
    name: string;
    uomId: string;
    uom: string;
  }) => {
    if (!itemPickerState) return;

    setItemPickerError(null);
    setIsSelectingItem(true);

    try {
      if (itemPickerState.mode === "parent") {
        const itemResponse = await itemsApi.getItem(item.id);
        const parsedDimensions = parseItemDimensions(itemResponse.data.dimensions);

        if (!parsedDimensions) {
          setItemPickerError("The selected item does not have valid width and height dimensions.");
          return;
        }

        const nextUnit = parsedDimensions.unit ?? sheetUnit;
        setParentSheetItem({
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          uomId: item.uomId,
          uomCode: item.uom,
        });
        setErrorMessage(null);
        resetLayoutToSheet(parsedDimensions.width, parsedDimensions.height, nextUnit);
        toast.success(`Parent sheet set to ${item.code}`);
        closeItemPicker();
        return;
      }

      if (!itemPickerState.sectionId) {
        setItemPickerError("Select a piece before mapping an item.");
        return;
      }

      const targetSection = sections.find((section) => section.id === itemPickerState.sectionId);
      if (!targetSection || targetSection.type !== "piece") {
        setItemPickerError("The selected piece is no longer available for mapping.");
        return;
      }

      const mappedSectionId = itemPickerState.sectionId;

      const nextSections = sections.map((section) => {
        if (section.id !== mappedSectionId) return section;
        return {
          ...section,
          mappedItem: {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            uomId: item.uomId,
            uomCode: item.uom,
          } satisfies SheetLayoutMappedItem,
        };
      });

      setErrorMessage(null);
      commitSections(nextSections);
      setSelectedSectionId(mappedSectionId);
      setRecentlyMappedSectionId(mappedSectionId);
      window.setTimeout(() => {
        setRecentlyMappedSectionId((current) =>
          current === mappedSectionId ? null : current
        );
      }, 1800);
      toast.success(`Mapped ${targetSection.label} to ${item.code}`);
      closeItemPicker();
    } catch (error) {
      setItemPickerError(
        error instanceof Error ? error.message : "Failed to load item details."
      );
    } finally {
      setIsSelectingItem(false);
    }
  };

  const pieceCount = pieceSections.length;
  const leftoverCount = sections.filter((section) => section.type === "leftover").length;

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setErrorMessage("Template name is required.");
      return;
    }

    if (!parentSheetItem) {
      setErrorMessage("Select a parent sheet item before saving the template.");
      return;
    }

    if (pieceCount === 0) {
      setErrorMessage("Create at least one piece before saving the template.");
      return;
    }

    if (unmappedPieceSections.length > 0) {
      setErrorMessage("Map every piece to a warehouse item before saving the template.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const payload: CreateTransformationTemplateRequest = {
      companyId: "",
      templateName: templateName.trim(),
      templateKind: "sheet_layout",
      sheetWidth,
      sheetHeight,
      sheetUnit,
      layout: {
        version: 1,
        sourceItem: parentSheetItem,
        sections,
      },
      inputs: [],
      outputs: [],
    };

    try {
      await createTemplate.mutateAsync(payload);
      router.push("/inventory/transformations/templates");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save template. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    const svg = svgRef.current;
    if (!svg) return;

    try {
      setIsExporting(true);
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to render layout image."));
        image.src = url;
      });

      const exportWidth = 1600;
      const exportHeight = Math.max(1, Math.round((sheetHeight / sheetWidth) * exportWidth));
      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas export is not available.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, exportWidth, exportHeight);
      context.drawImage(image, 0, 0, exportWidth, exportHeight);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${templateName.trim() || "sheet-layout-template"}.png`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export layout image.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Design New Template</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Split a parent sheet into smaller rectangular sections and save as a reusable template
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/inventory/transformations/templates")}>
            Cancel
          </Button>
          <Button onClick={handleSaveTemplate} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {/* Template Name Card */}
          <div className="rounded-lg border bg-card p-4">
            <label className="text-sm font-semibold">Template Name</label>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="e.g., 72 x 48 Sheet Layout"
              className="mt-2"
            />
          </div>

          {/* Parent Sheet Card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Parent Sheet</h3>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleOpenParentSheetPicker}
            >
              Select From Warehouse Item
            </Button>

            {parentSheetItem ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{parentSheetItem.itemCode}</span>
                  <Badge variant="secondary" className="text-xs">Source</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{parentSheetItem.itemName}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Use a warehouse item with dimensions, or enter manually below
              </p>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Dimensions</label>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  inputMode="decimal"
                  value={sheetWidthInput}
                  onChange={(event) => setSheetWidthInput(event.target.value)}
                  placeholder="Width"
                  className="text-sm"
                />
                <Input
                  inputMode="decimal"
                  value={sheetHeightInput}
                  onChange={(event) => setSheetHeightInput(event.target.value)}
                  placeholder="Height"
                  className="text-sm"
                />
                <Select value={sheetUnit} onValueChange={(value) => setSheetUnit(value as SheetLayoutUnit)}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="secondary" className="w-full" onClick={handleApplySheetSize}>
              Apply Sheet Size
            </Button>
          </div>

          {/* Tools Card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ScissorsLineDashed className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Tools</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={interactionMode === "draw" ? "default" : "outline"}
                onClick={() => {
                  setInteractionMode("draw");
                  setDragState(null);
                }}
                disabled={isCanvasLocked}
                className="h-auto flex-col gap-1 py-3"
              >
                <ScissorsLineDashed className="h-5 w-5" />
                <span className="text-xs">Draw Cut</span>
              </Button>
              <Button
                type="button"
                variant={interactionMode === "slice" ? "default" : "outline"}
                onClick={() => {
                  setInteractionMode("slice");
                  setDragState(null);
                }}
                disabled={isCanvasLocked}
                className="h-auto flex-col gap-1 py-3"
              >
                <Shapes className="h-5 w-5" />
                <span className="text-xs">Add Slice</span>
              </Button>
            </div>

            {interactionMode === "draw" ? (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground">Cut Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={splitOrientation === "vertical" ? "default" : "outline"}
                    onClick={() => setSplitOrientation("vertical")}
                    disabled={isCanvasLocked}
                  >
                    <MoveVertical className="mr-1.5 h-3.5 w-3.5" />
                    Vertical
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={splitOrientation === "horizontal" ? "default" : "outline"}
                    onClick={() => setSplitOrientation("horizontal")}
                    disabled={isCanvasLocked}
                  >
                    <MoveHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    Horizontal
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Click and drag inside a section to place the cut line
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">
                Enter slice dimensions and plot without drawing a cut line
              </p>
            )}
          </div>

          {/* Selection Card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">
              {selectedCut ? "Selected Cut" : selectedSection ? "Selected Section" : "Selection"}
            </h3>

            {selectedCut ? (
              <>
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedCut.orientation === "vertical" ? "Vertical Cut" : "Horizontal Cut"}
                    </span>
                    <Badge variant="outline" className="text-xs">Cut Line</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Between {selectedCut.a.label} and {selectedCut.b.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCut.orientation === "vertical"
                      ? `${selectedCut.a.height.toFixed(2)} ${sheetUnit} tall`
                      : `${selectedCut.a.width.toFixed(2)} ${sheetUnit} wide`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeleteSelectedCut}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" />
                  Delete Cut
                </Button>
              </>
            ) : selectedSection ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedSection.label}</span>
                    <Badge variant={selectedSection.type === "piece" ? "default" : "secondary"} className="text-xs">
                      {selectedSection.type === "piece" ? "Piece" : "Leftover"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedSection.width.toFixed(2)} x {selectedSection.height.toFixed(2)} {sheetUnit}
                  </p>

                  {selectedSection.type === "piece" && selectedSection.mappedItem && (
                    <div className="mt-2 rounded-md border bg-background px-2.5 py-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Mapped Item</p>
                      <p className="mt-0.5 text-xs font-medium">{selectedSection.mappedItem.itemCode}</p>
                      <p className="text-xs text-muted-foreground">{selectedSection.mappedItem.itemName}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSelectedSectionType("piece")}
                    className="text-xs"
                  >
                    Mark Piece
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSelectedSectionType("leftover")}
                    className="text-xs"
                  >
                    Mark Leftover
                  </Button>
                </div>

                {selectedSection.type === "piece" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openItemPicker({ mode: "piece", sectionId: selectedSection.id })}
                  >
                    {selectedSection.mappedItem ? "Remap Item" : "Map to Item"}
                  </Button>
                )}

                {interactionMode === "slice" && (
                  <div className="space-y-2 border-t pt-3">
                    <label className="text-xs font-medium">Quick Slice Dimensions</label>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        inputMode="decimal"
                        value={sliceWidthInput}
                        onChange={(event) => setSliceWidthInput(event.target.value)}
                        placeholder="Width"
                        className="h-8 text-xs"
                      />
                      <Input
                        inputMode="decimal"
                        value={sliceHeightInput}
                        onChange={(event) => setSliceHeightInput(event.target.value)}
                        placeholder="Height"
                        className="h-8 text-xs"
                      />
                      <div className="flex h-8 items-center justify-center rounded-md border px-2 text-xs text-muted-foreground">
                        {sheetUnit}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={handlePlotSlice}
                      disabled={isCanvasLocked}
                    >
                      Plot Slice
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Select a section or cut line to view details
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={handleUndo} disabled={!history.length}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Undo
            </Button>
            <Button type="button" variant="outline" onClick={handleRedo} disabled={!future.length}>
              <RotateCw className="mr-2 h-4 w-4" />
              Redo
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              <Eraser className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={isExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Download PNG"}
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Shapes className="h-4 w-4" />
              Layout Summary
            </div>
            <div className="mt-3 space-y-1 text-muted-foreground">
              <p>Sections: {sections.length}</p>
              <p>Pieces: {pieceCount}</p>
              <p>Mapped Pieces: {pieceCount - unmappedPieceSections.length}</p>
              <p>Leftovers: {leftoverCount}</p>
              <p>
                Parent Sheet: {sheetWidth} x {sheetHeight} {sheetUnit}
              </p>
            </div>
          </div>

        </div>

        <div className="overflow-auto rounded-lg border bg-muted/30 p-6">
          <div className="flex min-h-[640px] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-background p-6">
            <div className="relative w-full max-w-6xl">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
                className={cn(
                  "w-full rounded-lg border-2 bg-white shadow-sm",
                  isCanvasLocked && "opacity-60"
                )}
                style={{ aspectRatio: `${sheetWidth} / ${sheetHeight}` }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={handleCanvasContextMenu}
              >
                <rect
                  x={0}
                  y={0}
                  width={sheetWidth}
                  height={sheetHeight}
                  fill="#f8fafc"
                  stroke="#1e293b"
                  strokeWidth={0.35}
                />

                {sections.map((section) => {
                  const isSelected = section.id === selectedSectionId;
                  const isMappedPiece = section.type === "piece" && !!section.mappedItem;
                  const isRecentlyMapped = section.id === recentlyMappedSectionId;
                  const fill =
                    section.type === "piece"
                      ? isMappedPiece
                        ? "rgba(14, 165, 233, 0.18)"
                        : "rgba(99, 102, 241, 0.18)"
                      : "rgba(148, 163, 184, 0.16)";
                  const strokeColor = isSelected
                    ? "#38bdf8"
                    : isRecentlyMapped
                      ? "#0f766e"
                    : isMappedPiece
                      ? "#0284c7"
                      : "#64748b";
                  const textLayout = getSectionTextLayout(section);
                  const mappedItemLines =
                    section.mappedItem && textLayout.canShowMappedItem
                      ? wrapSvgText(
                          section.mappedItem.itemName,
                          Math.max(8, Math.floor(section.width * 0.75)),
                          section.height >= 24 ? 2 : 1
                        )
                      : [];

                  return (
                    <g key={section.id}>
                      <rect
                        data-section-id={section.id}
                        x={section.x}
                        y={section.y}
                        width={section.width}
                        height={section.height}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 0.42 : isRecentlyMapped ? 0.38 : 0.28}
                        className="cursor-crosshair"
                        onPointerDown={(event) => handleSectionPointerDown(section, event)}
                        onContextMenu={(event) => handleSectionContextMenu(section, event)}
                      />

                      {isMappedPiece && textLayout.canShowMappedItem && section.mappedItem ? (
                        <text
                          pointerEvents="none"
                          x={section.x + 0.5}
                          y={section.y + 0.9}
                          fontSize={0.58}
                          fontWeight={700}
                          fill="#0369a1"
                        >
                          {section.mappedItem.itemCode}
                        </text>
                      ) : null}

                      {textLayout.canShowTitle && (
                        <>
                          <text
                            pointerEvents="none"
                            x={section.x + section.width / 2}
                            y={
                              section.y +
                              section.height / 2 -
                              (textLayout.canShowDimensions ? textLayout.titleFontSize * 0.35 : 0)
                            }
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={textLayout.titleFontSize}
                            fontWeight={700}
                            fill="#0f172a"
                          >
                            {section.label}
                          </text>
                          {textLayout.canShowDimensions && (
                            <>
                              <text
                                pointerEvents="none"
                                x={section.x + section.width / 2}
                                y={
                                  section.y +
                                  section.height / 2 +
                                  textLayout.titleFontSize * 0.75
                                }
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={textLayout.dimensionFontSize}
                                fill="#334155"
                              >
                                {section.width.toFixed(2)} x {section.height.toFixed(2)} {sheetUnit}
                              </text>
                              {mappedItemLines.length ? (
                                <text
                                  pointerEvents="none"
                                  x={section.x + section.width / 2}
                                  y={
                                    section.y +
                                    section.height / 2 +
                                    textLayout.titleFontSize +
                                    textLayout.dimensionFontSize * 0.95
                                  }
                                  textAnchor="middle"
                                  fontSize={clamp(textLayout.dimensionFontSize * 0.82, 0.68, 1.05)}
                                  fontWeight={700}
                                  fill="#0369a1"
                                >
                                  {mappedItemLines.map((line, index) => (
                                    <tspan
                                      key={`${section.id}-mapped-line-${index}`}
                                      x={section.x + section.width / 2}
                                      dy={index === 0 ? textLayout.dimensionFontSize * 1.2 : textLayout.dimensionFontSize * 1.05}
                                    >
                                      {line}
                                    </tspan>
                                  ))}
                                </text>
                              ) : null}
                            </>
                          )}
                        </>
                      )}
                    </g>
                  );
                })}

                {mergeableCuts.map((cut) => {
                  const isSelected = cut.id === selectedCutId;

                  return (
                    <g key={cut.id}>
                      <line
                        x1={cut.x1}
                        y1={cut.y1}
                        x2={cut.x2}
                        y2={cut.y2}
                        stroke={isSelected ? "#dc2626" : "#94a3b8"}
                        strokeWidth={isSelected ? 0.8 : 0.3}
                        strokeDasharray={isSelected ? "1.4 1" : "1 1.6"}
                        pointerEvents="none"
                      />
                      <line
                        x1={cut.x1}
                        y1={cut.y1}
                        x2={cut.x2}
                        y2={cut.y2}
                        stroke="transparent"
                        strokeWidth={3}
                        className="cursor-pointer"
                        onClick={() => handleSelectCut(cut.id)}
                      />
                    </g>
                  );
                })}

                {dragMeasurement && (
                  <>
                    <line
                      x1={dragMeasurement.guide.x1}
                      y1={dragMeasurement.guide.y1}
                      x2={dragMeasurement.guide.x2}
                      y2={dragMeasurement.guide.y2}
                      stroke="#ef4444"
                      strokeWidth={0.5}
                      strokeDasharray="1.5 1.5"
                    />
                    <g>
                      {(() => {
                        const overlayWidth = Math.min(
                          Math.max(dragMeasurement.text.length * 0.42 + 1.8, 7.5),
                          14
                        );
                        const overlayHeight = 2.6;
                        const overlayX = clamp(
                          dragMeasurement.cursorX - overlayWidth / 2,
                          0.8,
                          sheetWidth - overlayWidth - 0.8
                        );
                        const overlayY = clamp(
                          dragMeasurement.cursorY - 4.2,
                          0.8,
                          sheetHeight - overlayHeight - 0.8
                        );

                        return (
                          <>
                      <rect
                            x={overlayX}
                            y={overlayY}
                            width={overlayWidth}
                            height={overlayHeight}
                            rx={0.65}
                            fill="#0f172a"
                            opacity={0.9}
                      />
                      <text
                            x={overlayX + overlayWidth / 2}
                            y={overlayY + overlayHeight / 2 + 0.15}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={0.72}
                            fontWeight={600}
                            fill="#ffffff"
                      >
                        {dragMeasurement.text}
                      </text>
                          </>
                        );
                      })()}
                    </g>
                  </>
                )}
              </svg>

              {isCanvasLocked ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="max-w-md rounded-2xl bg-slate-100/95 px-6 py-5 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/80">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-base font-semibold">Parent Sheet Required</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Select a parent sheet item before drawing cuts, adding slices, or editing the layout.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <ScissorsLineDashed className="h-3 w-3" />
                    {interactionMode === "draw"
                      ? splitOrientation === "vertical"
                        ? "Vertical cut mode"
                        : "Horizontal cut mode"
                      : "Slice input mode"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click an internal cut line to delete it. <br />
                  Rectangles stay within the parent sheet and never overlap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-56 rounded-lg border bg-card p-1.5 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handleContextSelectSection}
          >
            Select
          </button>
          <div className="my-1.5 h-px bg-border" />
          <div className="px-2 py-1.5 text-xs font-semibold text-foreground">Draw Cut</div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleContextDrawCut("vertical")}
          >
            <MoveVertical className="h-4 w-4 text-muted-foreground" />
            Vertical
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleContextDrawCut("horizontal")}
          >
            <MoveHorizontal className="h-4 w-4 text-muted-foreground" />
            Horizontal
          </button>
          <div className="my-1.5 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handleContextAddSlice}
          >
            <Shapes className="h-4 w-4 text-muted-foreground" />
            Add Slice
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleContextCopySlice}
            disabled={!selectedSection}
          >
            <ScissorsLineDashed className="h-4 w-4 text-muted-foreground" />
            Copy Slice
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleContextPasteSlice}
            disabled={!selectedSection || !sliceClipboard}
          >
            <ScissorsLineDashed className="h-4 w-4 text-muted-foreground" />
            Paste Slice
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleContextMapItem}
            disabled={selectedSection?.type !== "piece"}
          >
            <Package className="h-4 w-4 text-muted-foreground" />
            Map to Item
          </button>
          <div className="my-1.5 h-px bg-border" />
          <div className="px-2 py-1.5 text-xs font-semibold text-foreground">Edit</div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleContextMarkLeftover}
            disabled={selectedSection?.type === "leftover" || !selectedSection}
          >
            <Eraser className="h-4 w-4 text-muted-foreground" />
            Mark Leftover
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleUndo}
            disabled={!history.length}
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Undo
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleRedo}
            disabled={!future.length}
          >
            <RotateCw className="h-4 w-4 text-muted-foreground" />
            Redo
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleContextDeleteSection}
            disabled={selectedSection?.type !== "piece"}
          >
            <Eraser className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      <Dialog
        open={sliceDialogOpen}
        onOpenChange={(open) => (open ? setSliceDialogOpen(true) : closeSliceDialog())}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[42rem] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add Slice to {selectedSection?.label}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Enter slice dimensions for {selectedSection?.label || "the selected section"}.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dimensions</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px]">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="^-?\\d*(\\.\\d*)?$"
                  value={effectiveSliceWidthInput}
                  onChange={(event) => setSliceWidthInput(event.target.value)}
                  placeholder="Width"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="^-?\\d*(\\.\\d*)?$"
                  value={effectiveSliceHeightInput}
                  onChange={(event) => setSliceHeightInput(event.target.value)}
                  placeholder="Height"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                />
                <div className="flex h-10 items-center justify-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground">
                  {sheetUnit}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">Optional Item Mapping</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assign a warehouse item to the new slice as soon as it is created.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Popover open={sliceItemOpen} onOpenChange={setSliceItemOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={sliceItemOpen}
                      className={cn(
                        "min-w-0 flex-1 justify-between overflow-hidden",
                        !sliceDialogSelection && "text-muted-foreground"
                      )}
                    >
                      <span className="truncate">
                        {sliceDialogSelection
                          ? `${sliceDialogSelection.mappedItem.itemCode} - ${sliceDialogSelection.mappedItem.itemName}`
                          : "Search warehouse items"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    sideOffset={6}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search item by code or name"
                        value={sliceItemSearchInput}
                        onValueChange={setSliceItemSearchInput}
                      />
                      <CommandList className="max-h-[260px] overflow-y-auto">
                        {isLoadingSliceItemCandidates || isFetchingSliceItemCandidates ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading items...</span>
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                              {(sliceItemCandidatesResponse?.data || [])
                                .filter((item) => item.isActive)
                                .map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.code} ${item.name}`}
                                    onSelect={() =>
                                      handleSelectSliceItem({
                                        id: item.id,
                                        code: item.code,
                                        name: item.name,
                                        uomId: item.uomId,
                                        uom: item.uom,
                                      })
                                    }
                                    className="flex items-start gap-2 py-2"
                                  >
                                    <Check
                                      className={cn(
                                        "mt-0.5 h-4 w-4 shrink-0",
                                        sliceDialogSelection?.mappedItem.itemId === item.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="break-words text-sm font-semibold">
                                        {item.code}
                                      </div>
                                      <div className="break-words text-sm text-muted-foreground">
                                        {item.name}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Available: {(item.available ?? 0).toFixed(2)} {item.uom}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {sliceDialogSelection ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setSliceDialogSelection(null);
                      setSliceWidthInput("");
                      setSliceHeightInput("");
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            {sliceDialogError && (
              <div className="rounded-lg border border-destructive bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{sliceDialogError}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeSliceDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedSection) return;
                const result = applySliceToSection(
                  selectedSection,
                  Number(effectiveSliceWidthInput),
                  Number(effectiveSliceHeightInput),
                  sliceDialogSelection?.mappedItem ?? null
                );
                if (!result.ok) {
                  setSliceDialogError(result.error);
                  return;
                }

                setSliceDialogError(null);
                if (result.ok) {
                  closeSliceDialog();
                }
              }}
            >
              <Shapes className="mr-2 h-4 w-4" />
              Plot Slice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemPickerState} onOpenChange={(open) => (!open ? closeItemPicker() : undefined)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {itemPickerState ? getItemPickerTitle(itemPickerState.mode) : "Select Item"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {itemPickerState
                ? getItemPickerDescription(itemPickerState.mode, selectedContextSection?.label)
                : ""}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {currentWarehouse ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">Warehouse</p>
                <p className="mt-0.5 text-sm">
                  <span className="font-semibold">{currentWarehouse.code}</span>
                  <span className="text-muted-foreground"> · {currentWarehouse.name}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive bg-destructive/5 px-3 py-2.5">
                <p className="text-sm font-medium text-destructive">No warehouse is available for the current business unit.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Items</label>
              <Input
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Search by item code or item name"
                disabled={!currentWarehouse}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Available Items</label>
              <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2">
                {isLoadingItemCandidates ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading items...</span>
                  </div>
                ) : itemCandidatesResponse?.data.length ? (
                  itemCandidatesResponse.data.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-start justify-between rounded-md border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                      onClick={() =>
                        handleSelectCandidateItem({
                          id: item.id,
                          code: item.code,
                          name: item.name,
                          uomId: item.uomId,
                          uom: item.uom,
                        })
                      }
                      disabled={isSelectingItem}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.code}</p>
                        <p className="text-sm text-muted-foreground">{item.name}</p>
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-sm font-medium">{item.available.toFixed(2)} {item.uom}</p>
                        <p className="text-xs text-muted-foreground">available</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-12 text-center text-sm text-muted-foreground">
                    {itemSearch ? "No items matched your search." : "No warehouse items available."}
                  </div>
                )}
              </div>
            </div>
            {itemPickerError && (
              <div className="rounded-lg border border-destructive bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{itemPickerError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeItemPicker}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

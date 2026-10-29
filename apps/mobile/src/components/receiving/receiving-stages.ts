import type {
  ReceivingInboxDocumentKind,
  ReceivingInboxKindFilter,
  ReceivingInboxStage,
  ReceivingInboxStageCount,
  ReceivingInboxStageFilter,
} from "@/contracts/receiving";
import { colors } from "@/theme/colors";

export const RECEIVING_INBOX_STAGE_LABELS: Record<ReceivingInboxStage, string> = {
  in_progress: "In progress",
  ready: "Ready to receive",
  awaiting_approval: "Awaiting approval",
  expected: "Expected",
  completed: "Completed",
};

export const RECEIVING_INBOX_STAGE_COLORS: Record<ReceivingInboxStage, string> = {
  in_progress: colors.statusWarning,
  ready: colors.statusSuccess,
  awaiting_approval: colors.statusReview,
  expected: colors.statusInfo,
  completed: colors.statusNeutral,
};

export const RECEIVING_INBOX_STAGE_FILTERS: {
  value: ReceivingInboxStageFilter;
  label: string;
  hint: string;
}[] = [
  { value: "to_receive", label: "To receive", hint: "Ready and in progress" },
  { value: "ready", label: "Ready to receive", hint: "Arrived or dispatched, not started" },
  { value: "in_progress", label: "In progress", hint: "Started, not submitted" },
  { value: "expected", label: "Expected", hint: "Load lists confirmed or in transit" },
  {
    value: "awaiting_approval",
    label: "Awaiting approval",
    hint: "Load lists submitted for approval",
  },
  { value: "completed", label: "Completed", hint: "Received" },
  { value: "all", label: "All", hint: "Every stage" },
];

export const RECEIVING_INBOX_KIND_FILTERS: { value: ReceivingInboxKindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "load_list", label: "Load lists" },
  { value: "delivery_note", label: "Delivery notes" },
];

const stagesForFilter = (stage: ReceivingInboxStageFilter): ReceivingInboxStage[] | null => {
  if (stage === "all") return null;
  if (stage === "to_receive") return ["ready", "in_progress"];
  return [stage];
};

const kindMatches = (kind: ReceivingInboxDocumentKind, filter: ReceivingInboxKindFilter) =>
  filter === "all" || filter === kind;

export const countReceivingInbox = (
  stageCounts: ReceivingInboxStageCount[],
  stage: ReceivingInboxStageFilter,
  kind: ReceivingInboxKindFilter
) => {
  const stages = stagesForFilter(stage);
  return stageCounts.reduce(
    (total, entry) =>
      (stages === null || stages.includes(entry.stage)) && kindMatches(entry.kind, kind)
        ? total + entry.count
        : total,
    0
  );
};

export const canOpenReceivingInboxRow = (
  kind: ReceivingInboxDocumentKind,
  stage: ReceivingInboxStage
) =>
  kind === "load_list"
    ? stage === "ready" || stage === "in_progress"
    : stage === "ready" || stage === "in_progress" || stage === "completed";

const LOAD_LIST_STAGE_BY_STATUS: Record<string, ReceivingInboxStage> = {
  confirmed: "expected",
  in_transit: "expected",
  arrived: "ready",
  receiving: "in_progress",
  pending_approval: "awaiting_approval",
  received: "completed",
};

export const getLoadListStage = (status: string): ReceivingInboxStage | null =>
  LOAD_LIST_STAGE_BY_STATUS[status] ?? null;

export const getDeliveryNoteStage = (
  status: string,
  receivingStartedAt: string | null
): ReceivingInboxStage | null => {
  if (status === "received") return "completed";
  if (status !== "dispatched") return null;
  return receivingStartedAt ? "in_progress" : "ready";
};

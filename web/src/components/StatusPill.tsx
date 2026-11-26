import { STATUS_LABELS, type SlipStatus } from "@/lib/types";

const STYLE: Record<SlipStatus, string> = {
  ready: "bg-ok-soft text-ok",
  needs_review: "bg-warn-soft text-warn",
  duplicate: "bg-border/60 text-muted",
  processing: "bg-border/60 text-muted",
  unreadable: "bg-warn-soft text-warn",
};

export function StatusPill({ status }: { status: SlipStatus }) {
  return (
    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${STYLE[status]}`}>{STATUS_LABELS[status]}</span>
  );
}

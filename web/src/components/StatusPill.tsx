import type { ReactNode } from "react";
import { STATUS_LABELS, type SlipStatus } from "@/lib/types";

const STYLE: Record<SlipStatus, string> = {
  ready: "bg-ok-soft text-ok",
  needs_review: "bg-warn-soft text-warn",
  duplicate: "bg-background text-muted",
  processing: "bg-background text-muted",
  unreadable: "bg-warn-soft text-warn",
};

export function StatusPill({ status, children }: { status: SlipStatus; children?: ReactNode }) {
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs ${STYLE[status]}`}>
      {children}
      {STATUS_LABELS[status]}
    </span>
  );
}

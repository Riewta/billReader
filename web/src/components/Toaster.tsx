"use client";

import { CircleCheck, Undo2, X } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/i18n/provider";
import { useSlips } from "@/lib/store";

const DURATION_MS = 5000;

export function Toaster() {
  const { toast, dismissToast } = useSlips();
  const { t } = useI18n();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    // aria-live: screen reader อ่านผลการยืนยันให้ โดยไม่ต้องย้ายโฟกัส
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 md:bottom-6">
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl bg-foreground py-2.5 pr-2 pl-4 text-sm text-background shadow-lg"
        >
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          <span>
            {toast.kind === "removed" ? t.toast.removed : toast.kind === "one" ? t.toast.confirmed : t.toast.confirmedMany(toast.n)}
          </span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                dismissToast();
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-background/15"
            >
              <Undo2 className="size-3.5" aria-hidden />
              {t.toast.undo}
            </button>
          )}
          <button type="button" onClick={dismissToast} aria-label={t.toast.close} className="rounded-lg p-1 hover:bg-background/15">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

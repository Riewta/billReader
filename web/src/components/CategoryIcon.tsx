"use client";

import { useI18n } from "@/i18n/provider";
import { CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

export function CategoryIcon({ category, size = "md" }: { category: Category; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const { icon: Icon, chip } = CATEGORY_META[category];
  const box = size === "sm" ? "size-6 rounded-md" : "size-9 rounded-lg";
  const glyph = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span className={`grid shrink-0 place-items-center ${box} ${chip}`} title={t.categories[category]}>
      <Icon className={glyph} aria-hidden />
    </span>
  );
}

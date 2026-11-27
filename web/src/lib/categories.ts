import {
  ArrowLeftRight, Bus, Ellipsis, ReceiptText, ShoppingBag, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import type { Category } from "./types";

// แต่ละหมวดมีไอคอน + สีประจำ ใช้ซ้ำทุกหน้า: ผู้ใช้จำสีได้เร็วกว่าอ่านชื่อ
// สีใช้แยกหมวดเท่านั้น (เขียว/เหลืองถูกจองไว้ให้สถานะ "มั่นใจ/ต้องตรวจ")
export const CATEGORY_META: Record<Category, { icon: LucideIcon; chip: string; bar: string }> = {
  food: {
    icon: UtensilsCrossed,
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    bar: "bg-orange-400",
  },
  transport: {
    icon: Bus,
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    bar: "bg-sky-400",
  },
  shopping: {
    icon: ShoppingBag,
    chip: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
    bar: "bg-pink-400",
  },
  bills: {
    icon: ReceiptText,
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    bar: "bg-violet-400",
  },
  transfer: {
    icon: ArrowLeftRight,
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    bar: "bg-teal-400",
  },
  other: {
    icon: Ellipsis,
    chip: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    bar: "bg-stone-400",
  },
};

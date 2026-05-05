import { ScreenerClient } from "@/components/screener/ScreenerClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Screener",
  description:
    "Find mispriced companies with improving fundamentals using Yahoo chart and SEC EDGAR data.",
};

export default function ScreenerPage() {
  return <ScreenerClient />;
}

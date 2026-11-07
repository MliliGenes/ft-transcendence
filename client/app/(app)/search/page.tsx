import type { Metadata } from "next";
import { SearchView } from "@/components/app/search-view";

export const metadata: Metadata = { title: "Find your people — Nook" };

export default function SearchPage() {
  return <SearchView />;
}

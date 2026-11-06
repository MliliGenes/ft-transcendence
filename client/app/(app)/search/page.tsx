import type { Metadata } from "next";
import { SearchPeople } from "@/components/app/search-people";

export const metadata: Metadata = { title: "Find your people — Nook" };

export default function SearchPage() {
  return <SearchPeople />;
}

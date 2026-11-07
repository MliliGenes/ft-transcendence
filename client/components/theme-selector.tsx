"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-11 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Choose theme" disabled={!mounted} />}>
        <IconSun aria-hidden="true" className="dark:hidden" />
        <IconMoon aria-hidden="true" className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup aria-label="Theme" value={mounted ? theme : undefined} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="min-h-11"><IconSun aria-hidden="true" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="min-h-11"><IconMoon aria-hidden="true" />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="min-h-11"><IconDeviceDesktop aria-hidden="true" />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";

export function ThemeToggleWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <ThemeToggle />
    </ErrorBoundary>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <ToggleGroup type="single" size="sm" onValueChange={setTheme} value={theme}>
      <ToggleGroupItem value="light" aria-label="Light">
        <SunIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <MoonIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System">
        <DesktopIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

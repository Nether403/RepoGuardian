import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ["Alt", "H"], description: "Go to Home", category: "Navigation" },
  { keys: ["Alt", "S"], description: "Focus Search", category: "Navigation" },
  { keys: ["Alt", "D"], description: "Open Discover", category: "Navigation" },
  { keys: ["Alt", "P"], description: "Go to Profile", category: "Navigation" },
  { keys: ["Esc"], description: "Close Dialog/Menu", category: "Navigation" },
  
  // Actions
  { keys: ["Ctrl", "K"], description: "Open Command Palette", category: "Actions" },
  { keys: ["Ctrl", "Enter"], description: "Submit Form", category: "Actions" },
  { keys: ["?"], description: "Show Keyboard Shortcuts", category: "Actions" },
  
  // Accessibility
  { keys: ["Tab"], description: "Navigate Forward", category: "Accessibility" },
  { keys: ["Shift", "Tab"], description: "Navigate Backward", category: "Accessibility" },
  { keys: ["Enter"], description: "Activate Element", category: "Accessibility" },
  { keys: ["Space"], description: "Toggle/Select", category: "Accessibility" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts dialog with "?"
      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setOpen(true);
        }
      }

      // Close dialog with Escape
      if (e.key === "Escape" && open) {
        setOpen(false);
      }

      // Navigation shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "h":
            e.preventDefault();
            window.location.href = "/";
            break;
          case "s":
            e.preventDefault();
            const searchInput = document.querySelector<HTMLInputElement>('[data-testid="input-search"]');
            searchInput?.focus();
            break;
          case "d":
            e.preventDefault();
            window.location.href = "/discover";
            break;
          case "p":
            e.preventDefault();
            window.location.href = "/profile";
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and interact with the application more efficiently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs px-2 py-1"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Press <Badge variant="outline" className="font-mono text-xs mx-1">?</Badge> 
            anytime to view this dialog.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

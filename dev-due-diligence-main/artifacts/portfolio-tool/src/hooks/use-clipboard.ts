import { useState, useCallback } from "react";

export function useClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, []);

  return { copied, copy };
}

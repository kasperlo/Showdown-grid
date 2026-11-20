"use client";

import { useEffect, useRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";

type DraftInputProps = Omit<
  InputProps,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown"
> & {
  /** The stored value, shown whenever nothing is being typed. */
  value: string;
  /** Receives the raw text on blur and on Enter, to parse and store. */
  onCommit: (raw: string) => void;
};

/**
 * A field that keeps what is typed to itself until blur or Enter. Parsing on
 * every keystroke fought the typing: on the way to 200 the field holds "2",
 * which a minimum of 50 turned into 50, and a list split on commas ate the
 * comma just typed.
 */
export function DraftInput({ value, onCommit, ...props }: DraftInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef({ draft: null as string | null, onCommit });

  useEffect(() => {
    pending.current.onCommit = onCommit;
  });

  useEffect(() => {
    const field = pending.current;
    // A field removed while it has focus never blurs, for example when Esc
    // closes the sheet it sits in.
    return () => {
      if (field.draft !== null) field.onCommit(field.draft);
    };
  }, []);

  const commit = () => {
    const raw = pending.current.draft;
    pending.current.draft = null;
    setDraft(null);
    if (raw !== null) onCommit(raw);
  };

  return (
    <Input
      {...props}
      value={draft ?? value}
      onChange={(event) => {
        pending.current.draft = event.target.value;
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

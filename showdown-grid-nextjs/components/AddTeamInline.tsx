"use client";

import { useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

/**
 * Adding a team while the quiz is running.
 *
 * The person hosting is often not the person who built the quiz, and the teams
 * only exist once people have found a table. Teams are live state rather than
 * part of the template, so this deliberately does not require edit rights.
 *
 * The field stays open and clears itself after each team, because they are
 * entered in a burst of five while a room waits.
 */
export function AddTeamInline({ autoFocus = false }: { autoFocus?: boolean }) {
  const addTeam = useGameStore((s) => s.addTeam);
  const [name, setName] = useState("");

  const submit = () => {
    addTeam(name);
    setName("");
  };

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        // Enter adds the team explicitly instead of relying on the form's
        // implicit submission. preventDefault stops the browser from then
        // submitting as well and adding the team twice.
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          submit();
        }}
        placeholder="Lagnavn"
        aria-label="Lagnavn"
        autoFocus={autoFocus}
        maxLength={80}
        className="h-9"
      />
      <Button type="submit" size="sm" className="shrink-0 gap-1">
        <Plus className="h-4 w-4" />
        Legg til
      </Button>
    </form>
  );
}

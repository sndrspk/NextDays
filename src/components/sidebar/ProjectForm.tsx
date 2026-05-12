import { useEffect, useState } from "react";
import { DEFAULT_PROJECT_COLOUR, PROJECT_COLOURS } from "../../lib/projectColours";
import type { Project } from "../../types";

interface ProjectFormValues {
  name: string;
  colour: string;
  is_personal: boolean;
}

interface ProjectFormProps {
  initial?: Project;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
}

export default function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [colour, setColour] = useState(initial?.colour ?? DEFAULT_PROJECT_COLOUR);
  const [isPersonal, setIsPersonal] = useState(initial?.is_personal ?? true);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setColour(initial.colour);
      setIsPersonal(initial.is_personal);
    }
  }, [initial?.id]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onSubmit({ name: trimmed, colour, is_personal: isPersonal });
      }}
      className="space-y-3 rounded-md border border-stone-200 bg-white p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
      />

      <div className="flex flex-wrap gap-1.5">
        {PROJECT_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => setColour(c)}
            style={{ backgroundColor: c }}
            className={`h-5 w-5 rounded-full ring-offset-1 transition ${
              colour === c ? "ring-2 ring-stone-700" : "ring-0 hover:ring-1 hover:ring-stone-300"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-stone-600">
        <span>Type:</span>
        <button
          type="button"
          onClick={() => setIsPersonal(true)}
          className={`rounded-md px-2 py-1 ${
            isPersonal ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"
          }`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => setIsPersonal(false)}
          className={`rounded-md px-2 py-1 ${
            !isPersonal ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"
          }`}
        >
          Work
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs text-stone-500 hover:text-stone-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

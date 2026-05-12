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
      className="animate-fade-up space-y-3 rounded-xl border border-black/[0.06] bg-white p-3 shadow-card"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-[13px] text-stone-900 placeholder:text-stone-400 focus:border-accent focus:outline-none"
      />

      <div className="flex flex-wrap gap-1.5">
        {PROJECT_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => setColour(c)}
            style={{ backgroundColor: c }}
            className={`h-5 w-5 rounded-full ring-1 ring-inset ring-black/10 ring-offset-1 transition-all duration-150 ease-out-soft hover:scale-110 ${
              colour === c ? "ring-2 ring-accent ring-offset-2" : ""
            }`}
          />
        ))}
      </div>

      <div className="inline-flex gap-0.5 rounded-lg bg-stone-200/60 p-0.5 text-[11px]">
        {(
          [
            { v: true, label: "Personal" },
            { v: false, label: "Work" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setIsPersonal(opt.v)}
            className={`rounded-md px-2.5 py-0.5 font-medium transition-all duration-150 ease-out-soft ${
              isPersonal === opt.v
                ? "bg-white text-stone-900 shadow-card"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-1 pt-1 text-[11px]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-accent px-2.5 py-1 font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

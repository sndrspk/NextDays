import { FONT_OPTIONS, useSettings, type FontChoice } from "../../state/settings";
import BackupSection from "./BackupSection";

export default function SettingsView() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-5 sm:mb-6">
        <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
          Settings
        </h2>
        <p className="text-[12px] text-stone-500">
          Personalise NextDays and manage your data.
        </p>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto pb-10">
        <Panel title="Appearance" subtitle="The font used everywhere in the app.">
          <FontPicker />
        </Panel>

        <Panel title="Backup & Restore" subtitle="Export or restore your full dataset.">
          <BackupSection />
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 sm:px-6 sm:py-6">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold tracking-tight text-stone-900">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-stone-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function FontPicker() {
  const { font, setFont } = useSettings();
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Interface font</legend>
      {FONT_OPTIONS.map((opt) => (
        <FontOptionRow
          key={opt.id}
          id={opt.id}
          label={opt.label}
          stack={opt.stack}
          selected={font === opt.id}
          onSelect={() => setFont(opt.id)}
        />
      ))}
    </fieldset>
  );
}

function FontOptionRow({
  id,
  label,
  stack,
  selected,
  onSelect,
}: {
  id: FontChoice;
  label: string;
  stack: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
        selected
          ? "border-accent-100 bg-accent-50"
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="interface-font"
          value={id}
          checked={selected}
          onChange={onSelect}
          className="h-3.5 w-3.5 accent-accent"
        />
        <div>
          <div
            className={`text-[14px] ${selected ? "text-accent-700" : "text-stone-800"}`}
            style={{ fontFamily: stack }}
          >
            {label}
          </div>
          <div
            className="text-[12px] text-stone-500"
            style={{ fontFamily: stack }}
          >
            The quick brown fox jumps over the lazy dog.
          </div>
        </div>
      </div>
      {id === "inter" && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-stone-500">
          default
        </span>
      )}
    </label>
  );
}

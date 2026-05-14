import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  useSettings,
  type FontChoice,
  type FontSize,
} from "../../state/settings";
import BackupSection from "./BackupSection";
import TagsSection from "./TagsSection";
import IcsCalendarsSection from "./IcsCalendarsSection";

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

        <Panel
          title="Text size"
          subtitle="Scale every text and control proportionally."
        >
          <FontSizePicker />
        </Panel>

        <Panel
          title="Tags"
          subtitle="Rename or delete tags. Changes apply to every task and recurrence template using the tag."
        >
          <TagsSection />
        </Panel>

        <Panel
          title="Calendar feeds"
          subtitle="Subscribe to read-only .ics calendars. Events show up in your day columns and focus view."
        >
          <IcsCalendarsSection />
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

function FontSizePicker() {
  const { fontSize, setFontSize } = useSettings();
  return (
    <div
      role="radiogroup"
      aria-label="Text size"
      className="inline-flex rounded-lg border border-slate-200/80 bg-white p-0.5"
    >
      {FONT_SIZE_OPTIONS.map((opt) => (
        <FontSizeOptionButton
          key={opt.id}
          id={opt.id}
          label={opt.label}
          selected={fontSize === opt.id}
          onSelect={() => setFontSize(opt.id)}
        />
      ))}
    </div>
  );
}

function FontSizeOptionButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: FontSize;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  // Preview each option in its own visual scale so the difference is visible
  // without committing to it. `normal` is 13px, `larger` ~14.3px, `largest` ~15.6px.
  const previewSize = id === "normal" ? 13 : id === "larger" ? 14.3 : 15.6;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`focus-ring rounded-md px-3 py-1.5 transition-colors ${
        selected
          ? "bg-accent-50 text-accent-700"
          : "text-stone-600 hover:text-stone-900"
      }`}
      style={{ fontSize: `${previewSize}px` }}
    >
      {label}
    </button>
  );
}

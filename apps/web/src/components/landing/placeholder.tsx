/** Same footprint as the stage, so nothing below moves when it loads. */
export function StagePlaceholder() {
  return (
    <div aria-hidden className="flex h-full flex-col gap-4">
      {/* Height of the timeline: two rows on phones, one row from sm up. */}
      <div className="h-[90px] sm:h-[54px]" />
      <div className="flex-1 rounded-2xl border border-foreground/10 p-4 sm:p-5">
        <div className="mb-4 h-5 w-24 rounded bg-foreground/10" />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((column) => (
            <div key={column} className="h-[29rem] w-72 shrink-0 rounded-xl bg-foreground/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}

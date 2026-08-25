export default function RailDeProgression({
  pourcentage,
}: {
  pourcentage: number;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="shrink-0 text-right font-mono text-sm text-ink">
        {pourcentage}%
      </span>
    </div>
  );
}

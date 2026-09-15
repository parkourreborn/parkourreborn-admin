export default function PageHead({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-accent">{'// '}{eyebrow}</p>
        <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.06em] text-white sm:text-4xl">{title}</h2>
        {detail && <p className="mt-2 max-w-2xl text-base text-muted">{detail}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

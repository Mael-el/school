import type { ReactNode } from 'react';

/**
 * Glass panel wrapper shared by all Dashboard charts — matches the
 * `rounded-3xl border border-white/10 bg-white/5 ... backdrop-blur-xl`
 * treatment used for the main content panel in App.tsx.
 */
export function ChartPanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10 backdrop-blur-xl ${className ?? ''}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-white/50">
      {message}
    </div>
  );
}

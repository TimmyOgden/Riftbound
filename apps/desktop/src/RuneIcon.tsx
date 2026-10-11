import React from 'react';
const symbols: Record<string, React.ReactNode> = {
  fury: <path d="M13 2c1 6-5 7-3 12 1-2 3-3 3-6 5 4 8 8 5 12-4 4-11 2-12-2-2-6 4-8 7-16Z" />,
  calm: <><path d="M12 3c-4 4-5 8 0 13 5-5 4-9 0-13Z" /><path d="M3 8c0 7 3 11 9 12C8 11 6 9 3 8Zm18 0c0 7-3 11-9 12 4-9 6-11 9-12Z" /></>,
  mind: <><path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m12 6 4 6-4 6-4-6Z" /></>,
  body: <><path d="M5 13V8l3-1V4h3v6h1V3h3v7h1V5h3v9l-5 7H8l-5-6V11h3l3 5" /><path d="m9 16 6-3" fill="none" stroke="var(--rune-dark,#122129)" strokeWidth="1.5" /></>,
  chaos: <><path d="m13 2-2 8 8-5-3 8 6 2-10 7 1-8-8 5 3-8-6-2Z" /><circle cx="12" cy="12" r="2" fill="var(--rune-dark,#122129)" /></>,
  order: <><path d="m12 2 4 6-4 4-4-4Zm-9 6 7 6v7L3 14Zm18 0-7 6v7l7-7Z" /><path d="m12 14 2 3-2 5-2-5Z" /></>
};
export function RuneIcon({ domain = 'mind', className = '' }: { domain?: string; className?: string }) {
  return <svg className={`rune-icon ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{symbols[domain] ?? symbols.mind}</svg>;
}
export function RiftSigil({ className = '' }: { className?: string }) {
  return <svg className={`rift-icon ${className}`} viewBox="0 0 40 48" fill="none" aria-hidden="true"><path d="m20 3 16 20-16 22L4 23Z" stroke="currentColor" strokeWidth="2" /><path d="m20 10 10 13-10 15-10-15Z" fill="currentColor" opacity=".3" /><path d="m18 13-6 10 6 6m4-11 6 5-6 12" stroke="currentColor" strokeWidth="3" /><path d="m24 7-9 34" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

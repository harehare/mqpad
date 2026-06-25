export type LogoProps = {
  size?: number;
};

// A "pad" badge (rounded square) with a "|>" mark - mq's pipe-into-query
// syntax (`... | mq '...'`), rendered as a single pipe bar feeding a
// chevron. Colors track the active theme instead of being baked in.
export function Logo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="mqpad">
      <rect x="6" y="6" width="88" height="88" rx="22" fill="var(--mqpad-accent)" />
      <line
        x1="28"
        y1="30"
        x2="28"
        y2="70"
        stroke="var(--mqpad-accent-contrast)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M46 28 L74 50 L46 72"
        fill="none"
        stroke="var(--mqpad-accent-contrast)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

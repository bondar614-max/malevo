import { useId } from "react";

export function BrandLogo() {
  const gradientId = useId().replace(/:/g, "");

  return (
    <span className="flex items-center gap-2.5" aria-label="MALEVO">
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0 overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="5" y1="7" x2="35" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <path
          d="M6.5 30.5C8.2 23.2 10 16 12.2 8.7c.4-1.4 2.4-1.7 3.2-.5l5.1 8.2 5.7-7.8c.9-1.2 2.8-.7 2.9.8l1 13.7"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="5.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 32.2c7.8-2.5 18.1-2.2 30.9.7"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity=".88"
        />
      </svg>

      <span className="relative pb-1 font-black text-[1.18rem] leading-none tracking-[0.16em] text-white">
        MALEVO
        <svg
          className="absolute -bottom-0.5 left-0 h-2 w-full overflow-visible"
          viewBox="0 0 108 8"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M2 5.2C27 2.2 55 2.6 106 4.2"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity=".9"
          />
        </svg>
      </span>
    </span>
  );
}

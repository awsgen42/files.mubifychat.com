import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m20 6-11 11-5-5" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </Icon>
);

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
  </Icon>
);

export const TextIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21V9M7 13l5-5 5 5M4 3h16" />
  </Icon>
);

export const SendIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12 20 4l-8 16-2-6Z" />
  </Icon>
);

/** Stays on this device — used where that is the promise being made. */
export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

/** Direct transfer: bytes taking the short path rather than going via a server. */
export const BoltIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Icon>
);

export const PowerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v9" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </Icon>
);

/**
 * The brand mark, inline so it costs no request and can take the accent colour
 * from the theme. Geometry matches public/logo-mark.svg — the two must stay in
 * step, since one is the header and the other is what a home-screen shortcut
 * shows.
 *
 * The chevron is knocked out rather than drawn, so whatever is behind the mark
 * shows through it. That is why this needs a mask and cannot be a plain path.
 *
 * The mask id is fixed rather than generated. The mark appears more than once
 * per page — header and demo — so the id repeats, but every copy declares an
 * identical mask, and `url(#…)` resolving to the first is therefore always
 * right. Generating one would mean useId, which would make every component
 * rendering this a client component for no benefit.
 */
const MARK_MASK_ID = 'mubifiles-mark-knockout';

export const LogoMark = (props: IconProps) => (
  <svg viewBox="0 0 34 34" width={32} height={32} aria-hidden="true" {...props}>
    <mask id={MARK_MASK_ID}>
      <rect width="34" height="34" fill="#000" />
      <path
        d="M9.9 23.9 C6.6 23.9 4.2 21.0 5.2 17.9 C5.9 15.8 7.9 14.5 10.0 14.8 C10.3 10.4 14.1 7.1 18.5 7.5 C22.3 7.8 25.4 10.8 25.9 14.6 C28.6 14.6 30.7 17.0 30.3 19.7 C30.0 22.1 28.0 23.9 25.6 23.9 Z"
        fill="#fff"
      />
      <path
        d="M11.8 21.3 v-7.2 l5.4 4.3 5.4-4.3 v7.2"
        fill="none"
        stroke="#000"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </mask>
    <rect width="34" height="34" fill="var(--accent)" mask={`url(#${MARK_MASK_ID})`} />
  </svg>
);

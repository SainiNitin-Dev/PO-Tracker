import type { SVGProps } from "react";
const paths = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  train: "m6 6 12 12M3 8l5-5m-4 9 8-8m0 16 8-8m-4 9 5-5",
  chart: "M4 4v16h16M8 15l4-5 4 2 4-7",
  coach: "M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM8 10h8M8 14h5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  plan: "M9 5h11M9 12h11M9 19h11M3 5h1M3 12h1M3 19h1",
  camera: "M3 7h4l2-3h6l2 3h4v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}

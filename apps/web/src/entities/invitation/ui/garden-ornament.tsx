import styles from "./garden-invitation.module.css";

export function GardenOrnament() {
  return (
    <svg
      className={styles.ornament}
      viewBox="0 0 180 220"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M91 209C87 163 105 124 90 71M92 169C58 168 36 145 39 120C75 121 92 140 92 169ZM93 143C125 141 145 121 140 96C108 99 92 119 93 143ZM90 104C61 99 46 80 54 60C80 67 89 81 90 104Z" />
        <path d="M91 72C61 65 66 25 88 14C108 36 117 57 91 72ZM91 72C92 46 127 34 143 48C142 70 116 82 91 72ZM91 72C70 84 39 68 39 48C59 35 84 47 91 72Z" />
        <path d="M90 210H110M33 190H50M132 178H143" opacity=".5" />
      </g>
    </svg>
  );
}

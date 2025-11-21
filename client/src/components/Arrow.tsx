interface ArrowProps {
  className?: string;
  direction?: 'right' | 'left' | 'up' | 'down';
}

export function Arrow({ className = "", direction = 'right' }: ArrowProps) {
  const rotations = {
    right: '0',
    down: '90',
    left: '180',
    up: '270'
  };

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <path
        d="M3 8H13M13 8L9 4M13 8L9 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

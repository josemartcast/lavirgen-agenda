interface AvatarProps {
  name: string;
  color?: 'terracota' | 'salvia';
  size?: 'sm' | 'md' | 'lg';
}

const colorMap = {
  terracota: 'bg-terracota-claro text-terracota',
  salvia: 'bg-salvia-claro text-salvia',
};

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export function Avatar({ name, color = 'terracota', size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold font-sans flex-shrink-0 ${colorMap[color]} ${sizeMap[size]}`}
    >
      {initials}
    </div>
  );
}

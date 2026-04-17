interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

export const MaterialIcon = ({ name, className = "", filled = false }: MaterialIconProps) => (
  <span className={`material-symbols-outlined ${filled ? "fill" : ""} ${className}`}>
    {name}
  </span>
);

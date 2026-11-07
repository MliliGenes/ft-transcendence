import Image from "next/image";
import Avatar from "boring-avatars";

const colors = ["#F16B3A", "#171717", "#737373", "#D4D4D4", "#F5F5F5"];

export function AccountAvatar({
  source,
  seed,
  label,
  size,
  className,
}: {
  source: string | null;
  seed: string;
  label: string;
  size: number;
  className?: string;
}) {
  if (!source) {
    return <Avatar name={seed} variant="pixel" colors={colors} size={size} square className={className} role="img" aria-label={label} focusable="false" />;
  }
  return <Image src={source} alt={label} width={size} height={size} unoptimized className={className} />;
}

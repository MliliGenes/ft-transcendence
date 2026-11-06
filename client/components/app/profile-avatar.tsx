import Avatar from "boring-avatars";

const nookAvatarColors = ["#F16B3A", "#F5F5F5", "#767676", "#292929", "#B3B3B3"];

export function ProfileAvatar({
  username,
  size = 40,
  className,
}: {
  username: string;
  size?: number;
  className?: string;
}) {
  return (
    <Avatar
      name={username}
      size={size}
      variant="pixel"
      colors={nookAvatarColors}
      title
      square
      className={className}
    />
  );
}

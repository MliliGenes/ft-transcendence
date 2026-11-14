export function accountDisplayName(account: {
  displayName: string | null;
  username: string;
}) {
  return account.displayName?.trim() || account.username;
}

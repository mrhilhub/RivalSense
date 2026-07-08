export function getSharedOwnerUserId(fallbackUserId?: string | null) {
  return (
    process.env.NEXT_PUBLIC_SHARED_APP_OWNER_USER_ID ||
    process.env.DISCOVERY_OWNER_USER_ID ||
    fallbackUserId ||
    null
  );
}
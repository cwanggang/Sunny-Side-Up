// Client-chosen row ids, so media can be uploaded to `{circle_id}/{id}.ext` before the row exists
// (the insert policy requires the file to be there and owned by the sender).
// Hermes has no crypto.randomUUID and adding expo-crypto would mean a native reinstall. These ids
// are only primary keys (RLS still checks every insert), so Math.random-based v4 UUIDs are enough.
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

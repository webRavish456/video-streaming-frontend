import { useMemo } from "react";

function organizationsSignature(organizations) {
  const list = Array.isArray(organizations) ? organizations : [];
  return JSON.stringify(
    [...list]
      .map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        orgRole: String(o.orgRole ?? ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

export function useStableOrganizations(organizations) {
  const list = Array.isArray(organizations) ? organizations : [];
  const signature = organizationsSignature(organizations);
  return (
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable identity when signature unchanged
    useMemo(() => list, [signature])
  );
}

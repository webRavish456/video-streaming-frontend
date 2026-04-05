export function organizationsForChips(organizations, activeOrganizationId) {
  const list = Array.isArray(organizations) ? [...organizations] : [];
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });
  list.sort((a, b) =>
    collator.compare(String(a?.name ?? ""), String(b?.name ?? ""))
  );

  if (activeOrganizationId == null || activeOrganizationId === "") {
    return list;
  }

  const activeStr = String(activeOrganizationId);
  const idx = list.findIndex((o) => String(o.id) === activeStr);
  if (idx <= 0) return list;

  const [active] = list.splice(idx, 1);
  return [active, ...list];
}

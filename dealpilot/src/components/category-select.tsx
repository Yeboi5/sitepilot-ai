import { CATEGORIES } from "@/lib/domain/categories";

export function CategorySelect({ name = "categoryId", defaultValue, id }: { name?: string; defaultValue?: string; id?: string }) {
  return (
    <select className="input" name={name} id={id ?? name} defaultValue={defaultValue ?? ""} required>
      <option value="" disabled>Choose a category…</option>
      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export function RecurrenceSelect({ defaultValue = "one_off", name = "recurrence" }: { defaultValue?: string; name?: string }) {
  return (
    <select className="input" name={name} id={name} defaultValue={defaultValue}>
      <option value="one_off">One-off</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
      <option value="quarterly">Quarterly</option>
      <option value="annual">Annual</option>
    </select>
  );
}

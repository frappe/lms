export function withoutSelectedRows<T extends Record<string, unknown>>(
	rows: T[],
	selections: string[],
	identityKeys: (keyof T)[],
): T[] {
	const selected = new Set(selections)
	return rows.filter((row) =>
		identityKeys.every((key) => !selected.has(String(row[key] ?? ''))),
	)
}

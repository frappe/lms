export function createHandler(
	value: string | null,
	done: (() => void) | undefined,
	create: (name: string) => void
): void {
	if (!value) {
		done?.()
		return
	}
	create(value)
}

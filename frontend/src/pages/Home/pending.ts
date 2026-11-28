/** A resource that has neither answered nor failed yet; a refetch keeps its data. */
export const isPending = (
	resource?: { data?: unknown; error?: unknown } | null
) => !resource?.data && !resource?.error

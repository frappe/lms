/**
 * The positions 0 to count - 1 in an order that depends only on `seed`. The model tends to put
 * the right option last and to list sort items bucket by bucket, so exercises show their
 * options in this order instead. The same seed gives the same order on every render and
 * reload, so an answer keeps pointing at the option the learner saw.
 */
export const seededOrder = (count: number, seed: string): number[] => {
	let hash = 2166136261
	for (let i = 0; i < seed.length; i++)
		hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
	const next = () => {
		hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
		hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
		return (hash ^= hash >>> 16) >>> 0
	}
	const order = Array.from({ length: count }, (_, i) => i)
	for (let i = count - 1; i > 0; i--) {
		const j = next() % (i + 1)
		;[order[i], order[j]] = [order[j], order[i]]
	}
	return order
}

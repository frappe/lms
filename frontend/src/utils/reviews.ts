/** The whole star (1–5) a 0–5 rating counts under. */
export function starBucket(rating: number): number {
	return Math.min(5, Math.max(1, Math.round(rating)))
}

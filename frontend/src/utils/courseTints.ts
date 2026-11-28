// Whole class strings, so Tailwind finds each one in the source.
export const COURSE_TINTS: Record<string, string> = {
	red: 'bg-surface-red-2 text-ink-red-5',
	blue: 'bg-surface-blue-2 text-ink-blue-5',
	green: 'bg-surface-green-2 text-ink-green-5',
	amber: 'bg-surface-amber-2 text-ink-amber-5',
	cyan: 'bg-surface-cyan-2 text-ink-cyan-5',
	orange: 'bg-surface-orange-2 text-ink-orange-5',
	pink: 'bg-surface-pink-2 text-ink-pink-5',
	purple: 'bg-surface-purple-2 text-ink-purple-5',
	teal: 'bg-surface-teal-2 text-ink-teal-5',
	violet: 'bg-surface-violet-2 text-ink-violet-5',
	yellow: 'bg-surface-yellow-2 text-ink-yellow-5',
	gray: 'bg-surface-gray-2 text-ink-gray-6',
}

// Swatches for the colour picker, one per tint, a step stronger than it.
export const COURSE_SWATCHES: Record<string, string> = {
	red: 'bg-surface-red-3',
	blue: 'bg-surface-blue-3',
	green: 'bg-surface-green-3',
	amber: 'bg-surface-amber-3',
	cyan: 'bg-surface-cyan-3',
	orange: 'bg-surface-orange-3',
	pink: 'bg-surface-pink-3',
	purple: 'bg-surface-purple-3',
	teal: 'bg-surface-teal-3',
	violet: 'bg-surface-violet-3',
	yellow: 'bg-surface-yellow-3',
	gray: 'bg-surface-gray-3',
}

export function courseTint(color?: string | null): string {
	return COURSE_TINTS[(color || '').toLowerCase()] || COURSE_TINTS.blue
}

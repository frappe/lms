import { COURSE_SWATCHES } from '@/utils/courseTints'
import { defineIconClass } from '@/utils/lucideIconStyles'

// Whole class strings, so Tailwind's icon plugin builds these into the stylesheet.
const ICON_CLASSES: Record<string, string> = {
	boxes: 'lucide-boxes',
	'layout-template': 'lucide-layout-template',
	award: 'lucide-award',
	'code-xml': 'lucide-code-xml',
	database: 'lucide-database',
	calculator: 'lucide-calculator',
	factory: 'lucide-factory',
	package: 'lucide-package',
	users: 'lucide-users',
	handshake: 'lucide-handshake',
	'graduation-cap': 'lucide-graduation-cap',
	'book-open': 'lucide-book-open',
	palette: 'lucide-palette',
	'chart-line': 'lucide-chart-line',
	briefcase: 'lucide-briefcase',
	rocket: 'lucide-rocket',
	wrench: 'lucide-wrench',
	globe: 'lucide-globe',
	lightbulb: 'lucide-lightbulb',
	brain: 'lucide-brain',
	'flask-conical': 'lucide-flask-conical',
	microscope: 'lucide-microscope',
	music: 'lucide-music',
	camera: 'lucide-camera',
	languages: 'lucide-languages',
	scale: 'lucide-scale',
	'heart-pulse': 'lucide-heart-pulse',
	leaf: 'lucide-leaf',
	'shield-check': 'lucide-shield-check',
	megaphone: 'lucide-megaphone',
	'pen-tool': 'lucide-pen-tool',
	trophy: 'lucide-trophy',
	target: 'lucide-target',
	puzzle: 'lucide-puzzle',
	landmark: 'lucide-landmark',
	sprout: 'lucide-sprout',
}

/** The curated icons: shown first in the picker and the only ones shuffle picks. */
export const COURSE_ICONS: string[] = Object.keys(ICON_CLASSES)

const DEFAULT_ICON = 'book-open'

// Mirrors validate_icon in lms/lms/doctype/lms_course/lms_course.py.
const ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const isIconName = (name: string): boolean =>
	name.length <= 64 && ICON_NAME.test(name)

/**
 * The lucide class for a course icon name, or an open book. Any lucide icon
 * outside the curated set gets its class defined at runtime.
 */
export function courseIcon(name?: string | null): string {
	if (!name || !isIconName(name)) return ICON_CLASSES[DEFAULT_ICON]
	if (ICON_CLASSES[name]) return ICON_CLASSES[name]
	defineIconClass(name)
	return `lucide-${name}`
}

/** The colour as stored on the course: `Pink` for the `pink` swatch. */
export const courseColor = (swatch: string): string =>
	swatch.charAt(0).toUpperCase() + swatch.slice(1)

export interface CourseThumbnail {
	color: string
	icon: string
}

/** A random colour and curated icon, never the pair the course already has. */
export function shuffleThumbnail(
	color?: string | null,
	icon?: string | null
): CourseThumbnail {
	const current = `${(color || '').toLowerCase()}/${icon || DEFAULT_ICON}`
	const pairs = Object.keys(COURSE_SWATCHES)
		.flatMap((swatch) => COURSE_ICONS.map((name) => ({ swatch, name })))
		.filter(({ swatch, name }) => `${swatch}/${name}` !== current)
	const pick = pairs[Math.floor(Math.random() * pairs.length)]
	return { color: courseColor(pick.swatch), icon: pick.name }
}

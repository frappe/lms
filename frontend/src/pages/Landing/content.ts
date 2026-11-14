// Landing page copy that is product copy, not per-site. Brand elements (name,
// logo, colour, promo, hero, slides, branches and contact) come from LMS Settings
// through lms.lms.api.get_landing_content.

export interface LandingContent {
	enabled: boolean
	brand: { name: string; logo: string | null; primary_colour: string }
	promo: string
	hero: { eyebrow: string; headline: string; lede: string }
	slides: {
		eyebrow: string
		title: string
		text: string
		cta: { label: string; href: string }
	}[]
	branches: { label: string; name: string; address: string; phone: string }[]
	contact: { phone: string; email: string; website: string }
}

export const methodSteps: { name: string; hint: string }[] = [
	{ name: 'Engage', hint: 'Start with a question' },
	{ name: 'Explore', hint: 'Work the problem first' },
	{ name: 'Explain', hint: 'Put the idea into words' },
	{ name: 'Elaborate', hint: 'Apply it in new situations' },
	{ name: 'Evaluate', hint: 'Check what has stuck' },
]

export const testSeries = {
	label: 'Test Series',
	headline: 'Practice tests that show where you stand.',
	text: 'Regular tests, each followed by an analysis of your weak topics and guided corrections.',
}

export const whyUs: string[] = [
	'Best CBSE coaching institute in India',
	'Excellent results in Class 10 and Class 12',
	'Excellent faculties from IITs, NITs and premier institutes',
	'Courses integrated and aligned with IIT-JEE and NEET exams',
	'Digital and AC classrooms',
	'Online support',
]

export const scholarship = {
	title: 'Free scholarship test',
	text: 'Take the free scholarship test for 2026-27. Your score decides the scholarship you are offered. Pick your branch and class to register.',
}

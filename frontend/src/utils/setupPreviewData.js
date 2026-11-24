// A sample course and batch for the setup preview, by the answer to "Where will you be using
// Frappe Learning?". Shaped like the rows CourseCard and BatchCard get from the server. Before
// the owner lands on the site, the preview swaps them for the site's own demo course and batch.

// Tools whose content comes in best from a spreadsheet.
export const SPREADSHEET_TOOLS = ['Spreadsheets', 'Google Drive', 'Notion']

// Shaped like the instructor rows the server sends with a course or batch.
export const teacher = (fullName, name = fullName) => ({
	name,
	full_name: fullName,
	first_name: fullName.split(' ')[0],
})

const sample = (
	[title, lessons, enrollments, rating, intro, price],
	[batchTitle, batchIntro],
	instructor,
	cover
) => ({
	courses: [
		{
			name: title,
			title,
			lessons,
			enrollments,
			rating,
			short_introduction: intro,
			instructors: [teacher(instructor)],
			// A cover colour from the course form, so each use case looks its own; the demo
			// course has its real image.
			...cover,
			enable_certification: 1,
			price,
		},
	],
	batch: {
		name: batchTitle,
		title: batchTitle,
		description: batchIntro,
		seat_count: 20,
		seats_left: 20,
		start_date: '2026-12-01',
		end_date: '2026-12-31',
		start_time: '10:00:00',
		end_time: '11:00:00',
		instructors: [teacher(instructor)],
	},
})

export function samplesFor(usage) {
	const samples = {
		School: () =>
			sample(
				[
					__('Grade 8 Science'),
					12,
					48,
					4.6,
					__(
						'Matter, energy and the living world, one experiment at a time.'
					),
					'₹999',
				],
				[
					__('Young Scientists Lab'),
					__(
						'Hands-on experiments every Friday, ending with a science fair.'
					),
				],
				'Priya Nair',
				{ card_gradient: 'Green' }
			),
		'College or University': () =>
			sample(
				[
					__('Data Structures'),
					16,
					210,
					4.5,
					__(
						'Arrays to graphs, with weekly problem sets and a project.'
					),
					'₹2,499',
				],
				[
					__('Algorithms Bootcamp'),
					__(
						'Problem sets, pair programming and a final project you can show.'
					),
				],
				'R. Iyer',
				{ card_gradient: 'Blue' }
			),
		'Coaching or Training Institute': () =>
			sample(
				[
					__('JEE Physics crash course'),
					24,
					1240,
					4.7,
					__(
						'Mechanics to modern physics in 8 weeks, with 10 mock tests.'
					),
					'₹4,999',
				],
				[
					__('JEE 2027 Achievers'),
					__(
						'Daily problem drills and a full mock test every Sunday.'
					),
				],
				'Vikram Rao',
				{ card_gradient: 'Orange' }
			),
		'Company or Workplace': () =>
			sample(
				[
					__('Onboarding for new hires'),
					8,
					36,
					4.8,
					__('Your first week: tools, people and how we work.'),
					'₹0',
				],
				[
					__('First 90 Days Program'),
					__(
						'New joiners learn the tools, the team and how work gets done.'
					),
				],
				'Sara Thomas',
				{ card_gradient: 'Violet' }
			),
		'Customer Academy': () =>
			sample(
				[
					__('Workflow Automation Essentials'),
					7,
					2150,
					4.6,
					__(
						'Build, test and ship automations that save your team hours.'
					),
					'$49',
				],
				[
					__('Certified Admin Program'),
					__(
						'Live sessions that prepare admins for the certification exam.'
					),
				],
				'Lena Ortiz',
				{ card_gradient: 'Teal' }
			),
		'Personal Business': () =>
			sample(
				[
					__('Botanical Watercolour Masterclass'),
					10,
					320,
					4.9,
					__(
						'Layered washes, fine detail and a finished botanical study.'
					),
					'₹1,299',
				],
				[
					__('Botanical Art Circle'),
					__(
						'Paint flowers and leaves together, live every Saturday.'
					),
				],
				'Maya Fernandes',
				{ card_gradient: 'Pink' }
			),
		'Non-profit or Government': () =>
			sample(
				[
					__('Volunteer orientation'),
					6,
					230,
					4.5,
					__(
						'Who we are, how we work and what to expect in the field.'
					),
					'₹0',
				],
				[
					__('Community Champions'),
					__(
						'New volunteers learning to lead drives in their neighbourhood.'
					),
				],
				'Asha Pillai',
				{ card_gradient: 'Amber' }
			),
	}
	// Before an answer, the course is the one a new site has: the demo course.
	const fresh = () =>
		sample(
			[
				__('A guide to Frappe Learning'),
				5,
				0,
				0,
				__('Learn how to build and run courses on Frappe Learning.'),
				'',
			],
			[
				__('Course Builders Cohort'),
				__(
					'Learners take the demo course together, with a live class every week.'
				),
			],
			'Frappe',
			{ image: '/assets/lms/images/course_card.jpeg' }
		)
	return (
		samples[usage] || (usage ? samples['Company or Workplace'] : fresh)
	)()
}

const HINT = () => __('This helps us personalise your learning experience.')

// The setup questions. The keys are the ones capture_user_persona has always sent
// for these three; the old discovery question was dropped on purpose.
export function setupQuestions() {
	return [
		{
			key: 'usage_context',
			type: 'tags',
			title: __('Where will you be using Frappe Learning?'),
			subtitle: HINT(),
			options: [
				{ label: __('School'), value: 'School' },
				{
					label: __('College or University'),
					value: 'College or University',
				},
				{
					label: __('Coaching or Training Institute'),
					value: 'Coaching or Training Institute',
				},
				{
					label: __('Company or Workplace'),
					value: 'Company or Workplace',
				},
				{ label: __('Customer Academy'), value: 'Customer Academy' },
				{ label: __('Personal Business'), value: 'Personal Business' },
				{
					label: __('Non-profit or Government'),
					value: 'Non-profit or Government',
				},
				{ label: __('Other'), value: 'Other' },
			],
		},
		{
			key: 'current_tool',
			type: 'tags',
			title: __('What are you using today to manage learning?'),
			subtitle: HINT(),
			options: [
				{ label: __('Moodle'), value: 'Moodle', icon: 'moodle' },
				{
					label: __('Google Classroom'),
					value: 'Google Classroom',
					icon: 'google-classroom',
				},
				{ label: __('Canvas'), value: 'Canvas', icon: 'canvas' },
				{ label: __('Open edX'), value: 'Open edX', icon: 'open-edx' },
				{
					label: __('Classplus'),
					value: 'Classplus',
					icon: 'class-plus',
				},
				{
					label: __('Teachmint'),
					value: 'Teachmint',
					icon: 'teach-mint',
				},
				{
					label: __('LearnDash'),
					value: 'LearnDash',
					icon: 'learndash',
				},
				{
					label: __('Thinkific'),
					value: 'Thinkific',
					icon: 'thinkific',
				},
				{
					label: __('Teachable'),
					value: 'Teachable',
					icon: 'teachable',
				},
				{ label: __('Kajabi'), value: 'Kajabi', icon: 'kajabi' },
				{
					label: __('TalentLMS'),
					value: 'TalentLMS',
					icon: 'talent-lms',
				},
				{
					label: __('Google Drive'),
					value: 'Google Drive',
					icon: 'google-drive',
				},
				{ label: __('Notion'), value: 'Notion', icon: 'notion' },
				{
					label: __('Spreadsheets'),
					value: 'Spreadsheets',
					icon: 'spreadsheet',
				},
				{
					label: __('No LMS yet'),
					value: 'No LMS yet',
					icon: 'no_lms',
				},
				{ label: __('Other'), value: 'Other', icon: 'other' },
			],
		},
		{
			key: 'first_milestone',
			type: 'outcome',
			title: __('Your workspace is ready'),
			subtitle: __('Where do you want to start?'),
			options: [
				{
					label: __('Publish my first course'),
					value: 'Publish my first course',
					description: __('Set up your first course and lessons.'),
					icon: 'lucide-book-open',
					route: { name: 'Courses' },
				},
				{
					label: __('Onboard my existing learners'),
					value: 'Onboard my existing learners',
					description: __('Bring your learners into a batch.'),
					icon: 'lucide-users',
					route: { name: 'Batches' },
				},
				{
					label: __('Award my first certificate'),
					value: 'Award my first certificate',
					description: __('Configure certification for a course.'),
					icon: 'lucide-award',
					route: { name: 'Courses' },
				},
				{
					label: __('Launch a paid course'),
					value: 'Launch a paid course',
					description: __('Add pricing and go live.'),
					icon: 'lucide-rocket',
					route: { name: 'Courses' },
				},
				{
					label: __('Just exploring'),
					value: 'Just exploring',
					description: __('Poke around a sample course.'),
					icon: 'lucide-compass',
					route: { name: 'Courses' },
				},
			],
		},
	]
}

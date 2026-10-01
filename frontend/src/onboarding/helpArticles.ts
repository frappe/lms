import type { HelpArticle } from '@framework/ui/components/Onboarding/index'

export const HELP_DOCS_LINK = 'https://docs.frappe.io/learning'

/**
 * The docs tree the sidebar handed the framework HelpModal before the flows
 * replaced it. A function, because `__` is only installed after every static
 * import has been evaluated.
 */
export function helpArticles(): HelpArticle[] {
	return [
		{
			title: __('Introduction'),
			opened: false,
			subArticles: [
				{ name: 'introduction', title: __('Introduction') },
				{ name: 'setting-up', title: __('Setting up') },
			],
		},
		{
			title: __('Creating a course'),
			opened: false,
			subArticles: [
				{ name: 'create-a-course', title: __('Create a course') },
				{ name: 'add-a-chapter', title: __('Add a chapter') },
				{ name: 'add-a-lesson', title: __('Add a lesson') },
			],
		},
		{
			title: __('Creating a batch'),
			opened: false,
			subArticles: [
				{ name: 'create-a-batch', title: __('Create a batch') },
				{ name: 'create-a-live-class', title: __('Create a live class') },
			],
		},
		{
			title: __('Learning Paths'),
			opened: false,
			subArticles: [{ name: 'add-a-program', title: __('Add a program') }],
		},
		{
			title: __('Assessments'),
			opened: false,
			subArticles: [
				{ name: 'quizzes', title: __('Quizzes') },
				{ name: 'assignments', title: __('Assignments') },
			],
		},
		{
			title: __('Certification'),
			opened: false,
			subArticles: [
				{ name: 'issue-a-certificate', title: __('Issue a Certificate') },
				{
					name: 'custom-certificate-templates',
					title: __('Custom Certificate Templates'),
				},
			],
		},
		{
			title: __('Monetization'),
			opened: false,
			subArticles: [
				{
					name: 'setting-up-payment-gateway',
					title: __('Setting up payment gateway'),
				},
			],
		},
		{
			title: __('Settings'),
			opened: false,
			subArticles: [{ name: 'roles', title: __('Roles') }],
		},
	]
}

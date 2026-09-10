import { markRaw } from 'vue'
import type { SettingsGroup } from '@/types/settingsSchema'
import Categories from '@/components/Settings/Categories.vue'
import Members from '@/components/Settings/Members.vue'
import EmailConfig from '@/components/Settings/EmailAccount/EmailConfig.vue'
import { sidebarSettingsPage } from '@/components/Settings/Sidebar/sidebar'
// BrandSettings.vue is still `<script setup>` with no `lang="ts"`, so a TS
// importer gets TS7016; only settingsStructure.js reached it before. Clears
// itself once the component is converted.
// @ts-expect-error TS7016: untyped SFC
import BrandSettings from '@/components/Settings/BrandSettings.vue'
import PaymentGateways from '@/components/Settings/PaymentGateways/PaymentGateways.vue'
import Coupons from '@/components/Settings/Coupons/Coupons.vue'
import { transactionsPage } from '@/components/Settings/Transactions/transactions'
import { badgesSettingsPage } from '@/components/Settings/Badges/badges'
import { zoomSettingsPage } from '@/components/Settings/Zoom/zoom'
import {
	canManageGoogleMeet,
	googleMeetSettingsPage,
} from '@/components/Settings/GoogleMeet/googleMeet'
import RavenSettings from '@/components/Settings/Raven/RavenSettings.vue'
import Preferences from '@/components/Settings/Preferences.vue'

/**
 * The settings tree, as data. Ported from settingsStructure.js, with every
 * item carrying a declared slug so a renamed label can't break a bookmark.
 * Panels still rendered by a component are `kind: 'custom'` until ported.
 */
export const settingsTree: SettingsGroup[] = [
	{
		label: 'System Configuration',
		hideLabel: false,
		items: [
			{
				label: 'General',
				slug: 'general',
				icon: 'lucide-settings-2',
				page: { kind: 'custom', component: markRaw(Preferences) },
			},
			{
				label: 'Signup',
				slug: 'signup',
				icon: 'lucide-log-in',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'Signup',
							fields: [
								{
									label: 'Identify User Category',
									name: 'user_category',
									type: 'checkbox',
									description:
										'Enable this option to identify the user category during signup.',
								},
								{
									label: 'Disable signup',
									name: 'disable_signup',
									type: 'checkbox',
									description:
										'New users will have to be manually registered by Admins.',
								},
								{
									label: 'Signup Consent HTML',
									name: 'custom_signup_content',
									type: 'code',
									mode: 'htmlmixed',
									rows: 10,
									description:
										'Custom HTML shown on the signup page, e.g. for consent notices or terms of service.',
								},
							],
						},
					],
				},
			},
		],
	},
	{
		label: 'Course Configuration',
		hideLabel: false,
		items: [
			{
				label: 'Progress',
				slug: 'course-progress',
				icon: 'lucide-activity',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'Completion Time',
							fields: [
								{
									label: 'Lesson Completion Time (seconds)',
									name: 'lesson_dwell_time',
									type: 'number',
									min: 1,
									description:
										'Seconds a learner must stay on a lesson before it auto-marks complete.',
								},
							],
						},
						{
							label: 'Enforcement',
							fields: [
								{
									label: 'Enforce video completion',
									name: 'enforce_video_completion',
									type: 'checkbox',
									description:
										'When enabled, lessons that contain a video can only be marked complete by playing the video to the end. If the video fails to load, the dwell timer is used as a fallback.',
								},
								{
									label: 'Enforce assignment completion',
									name: 'enforce_assignment_completion',
									type: 'checkbox',
									description:
										'When enabled, lessons with an assignment cannot be marked complete until the assignment is submitted.',
								},
								{
									label: 'Enforce quiz completion',
									name: 'enforce_quiz_completion',
									type: 'checkbox',
									description:
										'When enabled, lessons with a quiz cannot be marked complete until the quiz is submitted.',
								},
								{
									label: 'Prevent Skipping Videos',
									name: 'prevent_skipping_videos',
									type: 'checkbox',
									description:
										'If enabled, users will no able to move forward in a video',
								},
							],
						},
					],
				},
			},
			{
				label: 'Badges',
				slug: 'badges',
				icon: 'lucide-award',
				records: true,
				page: badgesSettingsPage,
			},
			{
				label: 'Categories',
				slug: 'categories',
				icon: 'lucide-network',
				page: { kind: 'custom', component: markRaw(Categories) },
			},
		],
	},
	{
		label: 'Communication',
		items: [
			{
				label: 'Email Accounts',
				slug: 'email-accounts',
				icon: 'lucide-mail',
				// Interim: the moderator-gated record-page split (EmailAccounts.ts,
				// EmailAccountForm.vue) is deferred to a reconciliation task against
				// a second implementation. Renders EmailConfig.vue until that lands.
				page: { kind: 'custom', component: markRaw(EmailConfig) },
			},
		],
	},
	{
		label: 'User Management',
		hideLabel: false,
		items: [
			{
				label: 'Users',
				slug: 'members',
				icon: 'lucide-user',
				// Interim: the Members record-page split lands in its own phase.
				// Renders the pre-existing Members.vue until then.
				page: { kind: 'custom', component: markRaw(Members) },
			},
		],
	},
	{
		label: 'Payment',
		hideLabel: false,
		items: [
			{
				label: 'Configuration',
				slug: 'payments',
				icon: 'lucide-credit-card',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'Configuration',
							fields: [
								{
									label: 'Default Currency',
									name: 'default_currency',
									type: 'link',
									doctype: 'Currency',
									description:
										'Default currency used for course and batch pricing.',
									// Shown, never written by being shown. Nothing on the
									// server resolves a blank default_currency: LMS Course's
									// desk form copies this value (blank included) into a new
									// course's currency, so the page must answer for itself.
									// USD is the app's reference currency already:
									// check_multicurrency converts into it and short-circuits.
									displayFallback: 'USD',
								},
								{
									label: 'Show USD equivalent amount',
									name: 'show_usd_equivalent',
									type: 'checkbox',
									description:
										'If enabled, it shows the USD equivalent amount for all transactions based on the current exchange rate.',
								},
								{
									label: 'Apply rounding on equivalent',
									name: 'apply_rounding',
									type: 'checkbox',
									description:
										'If enabled, it applies rounding on the USD equivalent amount.',
								},
								{
									label: 'Payment Gateway',
									name: 'payment_gateway',
									type: 'link',
									doctype: 'Payment Gateway',
									description:
										'Payment gateway used to process course and batch purchases.',
								},
								{
									label: 'Apply GST for India',
									name: 'apply_gst',
									type: 'checkbox',
									description:
										'If enabled, GST will be applied to the price for students from India.',
								},
							],
						},
						{
							label: 'Payment Reminders',
							fields: [
								{
									label: 'Send payment reminders for batch',
									name: 'send_payment_reminders_for_batch',
									type: 'checkbox',
									description:
										'If enabled, it sends payment reminders to students who left the payment incomplete for a batch.',
								},
								{
									label: 'Send payment reminders for course',
									name: 'send_payment_reminders_for_course',
									type: 'checkbox',
									description:
										'If enabled, it sends payment reminders to students who left the payment incomplete for a course.',
								},
							],
						},
					],
				},
			},
			{
				label: 'Gateways',
				slug: 'payment-gateways',
				icon: 'lucide-dollar-sign',
				records: true,
				page: { kind: 'custom', component: markRaw(PaymentGateways) },
			},
			{
				label: 'Transactions',
				slug: 'transactions',
				icon: 'lucide-landmark',
				records: true,
				page: transactionsPage,
			},
			{
				label: 'Coupons',
				slug: 'coupons',
				icon: 'lucide-ticket',
				records: true,
				page: { kind: 'custom', component: markRaw(Coupons) },
			},
		],
	},
	{
		label: 'Conferencing',
		hideLabel: false,
		items: [
			{
				label: 'Google Meet',
				slug: 'google-meet',
				icon: 'lucide-presentation',
				records: true,
				condition: canManageGoogleMeet,
				page: googleMeetSettingsPage,
			},
			{
				label: 'Zoom',
				slug: 'zoom',
				icon: 'lucide-video',
				records: true,
				page: zoomSettingsPage,
			},
		],
	},
	{
		label: 'Integrations',
		hideLabel: false,
		items: [
			{
				label: 'Raven',
				slug: 'raven',
				icon: 'lucide-messages-square',
				page: { kind: 'custom', component: markRaw(RavenSettings) },
			},
			{
				label: 'Services',
				slug: 'services',
				icon: 'lucide-key-round',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'Services',
							fields: [
								{
									label: 'Livecode URL',
									name: 'livecode_url',
									type: 'text',
									description:
										"Address of the LiveCode server that runs the code learners write in programming exercises. Leave it blank to use Frappe's hosted server, or see https://docs.frappe.io/learning/falcon-self-hosting-guide to host your own.",
								},
								{
									label: 'Unsplash Access Key',
									name: 'unsplash_access_key',
									type: 'password',
									description:
										'Allows users to pick a profile cover image from Unsplash. https://unsplash.com/documentation#getting-started.',
								},
							],
						},
					],
				},
			},
		],
	},
	{
		label: 'Customization',
		hideLabel: false,
		items: [
			{
				label: 'Branding',
				slug: 'branding',
				icon: 'lucide-palette',
				page: { kind: 'custom', component: markRaw(BrandSettings) },
			},
			sidebarSettingsPage,
			{
				label: 'SEO',
				slug: 'seo',
				icon: 'lucide-search',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'SEO',
							fields: [
								{
									label: 'Meta Description',
									name: 'meta_description',
									type: 'textarea',
									rows: 4,
									description:
										"This description will be shown on lists and pages that don't have meta description",
								},
								{
									label: 'Meta Keywords',
									name: 'meta_keywords',
									type: 'textarea',
									rows: 4,
									description:
										'Comma separated keywords for search engines to find your website.',
								},
								{
									label: 'Meta Image',
									name: 'meta_image',
									type: 'upload',
									size: 'lg',
									// Open Graph image: unauthenticated crawlers fetch it.
									public: true,
									description:
										'Default social-share image used when pages lack their own meta image.',
								},
							],
						},
					],
				},
			},
		],
	},
]

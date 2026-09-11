import { defineAsyncComponent, markRaw } from 'vue'
import type { SettingsGroup } from '@/types/settingsSchema'
import Categories from '@/components/Settings/Categories.vue'
import { membersSettingsPage } from '@/components/Settings/Members/members'
import { emailAccountsPage } from '@/components/Settings/EmailAccount/emailAccounts'
import { emailTemplateSettingsPage } from '@/components/Settings/EmailTemplate/emailTemplate'
import { sidebarSettingsPage } from '@/components/Settings/Sidebar/sidebar'
// BrandSettings.vue is still `<script setup>` with no `lang="ts"`, so a TS
// importer gets TS7016; only settingsStructure.js reached it before. Clears
// itself once the component is converted.
// @ts-expect-error TS7016: untyped SFC
import BrandSettings from '@/components/Settings/BrandSettings.vue'
import PaymentGateways from '@/components/Settings/PaymentGateways/PaymentGateways.vue'
import Coupons from '@/components/Settings/Coupons/Coupons.vue'
import { transactionsPage } from '@/components/Settings/Transactions/transactions'
import { badgeAssignmentsSettingsPage } from '@/components/Settings/Badges/badgeAssignments'
import { badgesSettingsPage } from '@/components/Settings/Badges/badges'
import { zoomSettingsPage } from '@/components/Settings/Zoom/zoom'
import {
	canManageGoogleMeet,
	googleMeetSettingsPage,
} from '@/components/Settings/GoogleMeet/googleMeet'
import { canManageGoogleIntegrations } from '@/components/Settings/GoogleApi/googleApi'
import Services from '@/components/Settings/Services/Services.vue'
import { googleCalendarSettingsPage } from '@/components/Settings/GoogleCalendar/googleCalendar'
import RavenSettings from '@/components/Settings/Raven/RavenSettings.vue'
import Preferences from '@/components/Settings/Preferences.vue'

// Loaded on demand, same as the Email Accounts form below it in the tree:
// Communication > General renders every time Settings opens, and this reads
// a second list nothing else on the page needs.
const emailAccountDefaults = markRaw(
	defineAsyncComponent(
		() => import('@/components/Settings/EmailAccount/EmailAccountDefaults.vue')
	)
)

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
				label: 'Badge Assignments',
				slug: 'badge-assignments',
				icon: 'lucide-badge-check',
				records: true,
				page: badgeAssignmentsSettingsPage,
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
				label: 'General',
				slug: 'communication-general',
				icon: 'lucide-settings-2',
				// Moved back here from Preferences.vue, since both are about how
				// the site communicates. Both write LMS Settings, which
				// Preferences.vue already autosaves, so this page needs no writer.
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: 'Contact Information',
							fields: [
								{
									label: 'Email',
									name: 'contact_us_email',
									type: 'text',
									fullWidth: true,
								},
								{
									label: 'URL',
									name: 'contact_us_url',
									type: 'text',
									fullWidth: true,
									noDivider: true,
								},
							],
						},
						// Both override the notification rule's own wording. Shown
						// here so a site that set one can clear it.
						{
							label: 'Email Templates',
							fields: [
								{
									label: 'Batch Confirmation Template',
									name: 'batch_confirmation_template',
									type: 'link',
									doctype: 'Email Template',
									// CRM adds an `enabled` Check field to Email Template,
									// defaulting to disabled, and search_widget filters on
									// it unless told otherwise. See the `filters` doc comment.
									filters: { include_disabled: 1 },
									description:
										'Replaces the wording of the batch enrollment notification.',
								},
								{
									label: 'Certificate Email Template',
									name: 'certification_template',
									type: 'link',
									doctype: 'Email Template',
									filters: { include_disabled: 1 },
									description:
										'Replaces the wording of the certification notification.',
								},
							],
						},
					],
					extra: { component: emailAccountDefaults },
				},
			},
			{
				label: 'Email Template',
				slug: 'email-template',
				icon: 'lucide-mail-plus',
				records: true,
				page: emailTemplateSettingsPage,
			},
			{
				label: 'Email Accounts',
				slug: 'email-accounts',
				icon: 'lucide-mail',
				records: true,
				page: emailAccountsPage,
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
				page: membersSettingsPage,
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
		// Conferencing folded in here. Google Meet, Calendar and Zoom are
		// conferencing providers, no different from the rest of Integrations.
		label: 'Integrations',
		hideLabel: false,
		items: [
			{
				label: 'Services',
				slug: 'services',
				icon: 'lucide-key-round',
				page: { kind: 'custom', component: markRaw(Services) },
			},
			{
				label: 'Google Calendar',
				slug: 'google-calendar',
				icon: 'lucide-calendar',
				records: true,
				condition: canManageGoogleIntegrations,
				page: googleCalendarSettingsPage,
			},
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
			{
				label: 'Raven',
				slug: 'raven',
				icon: 'lucide-messages-square',
				page: { kind: 'custom', component: markRaw(RavenSettings) },
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

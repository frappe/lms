import { defineAsyncComponent, h, markRaw } from 'vue'
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
import CloudPanel from '@/components/Settings/CloudPanel.vue'
import { hasCloudSettings } from '@/composables/cloudSettings'
import { usersStore } from '@/stores/user'
import type { CloudSettingsPanel } from '@frappe/cloud-sdk'

// Loaded on demand, same as the Email Accounts form below it in the tree:
// Communication > General renders every time Settings opens, and this reads
// a second list nothing else on the page needs.
const emailAccountDefaults = markRaw(
	defineAsyncComponent(
		() => import('@/components/Settings/EmailAccount/EmailAccountDefaults.vue')
	)
)

const cloudPanel = (panel: CloudSettingsPanel) =>
	markRaw(() => h(CloudPanel, { panel }))

/**
 * The settings tree, as data. Ported from settingsStructure.js, with every
 * item carrying a declared slug so a renamed label can't break a bookmark.
 * Panels still rendered by a component are `kind: 'custom'` until ported.
 */
// `__` here only marks strings for the catalog: it runs before translations
// load, and the components that draw the tree translate them on render.
export const settingsTree: SettingsGroup[] = [
	{
		label: __('System Configuration'),
		items: [
			{
				label: __('General'),
				slug: 'general',
				icon: 'lucide-settings-2',
				page: { kind: 'custom', component: markRaw(Preferences) },
			},
			{
				label: __('Signup'),
				slug: 'signup',
				icon: 'lucide-log-in',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: __('Signup'),
							fields: [
								{
									label: __('Identify User Category'),
									name: 'user_category',
									type: 'checkbox',
									description: __(
										'Enable this option to identify the user category during signup.'
									),
								},
								{
									label: __('Disable signup'),
									name: 'disable_signup',
									type: 'checkbox',
									description: __(
										'New users will have to be manually registered by Admins.'
									),
								},
								{
									label: __('Signup Consent HTML'),
									name: 'custom_signup_content',
									type: 'code',
									mode: 'htmlmixed',
									rows: 10,
									description: __(
										'Custom HTML shown on the signup page, e.g. for consent notices or terms of service.'
									),
								},
							],
						},
					],
				},
			},
		],
	},
	{
		label: __('Course Configuration'),
		items: [
			{
				label: __('Progress'),
				slug: 'course-progress',
				icon: 'lucide-activity',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: __('Lesson Completion'),
							fields: [
								{
									label: __('Lesson Completion Time (seconds)'),
									name: 'lesson_dwell_time',
									type: 'number',
									min: 1,
									description: __(
										'Seconds a learner must stay on a lesson before it is marked complete.'
									),
								},
								{
									label: __('Enforce completion'),
									name: 'enforce_completion',
									type: 'checkboxGroup',
									description: __(
										'A lesson is marked complete only once the selected items are done.'
									),
									options: [
										{
											label: __('Videos'),
											name: 'enforce_video_completion',
											caution: __(
												'A video that fails to load, or comes from Cloudflare Stream, Google Drive, Aparat or another embedded link, cannot be tracked, so its lesson completes on the completion time instead.'
											),
										},
										{
											label: __('Quizzes'),
											name: 'enforce_quiz_completion',
										},
										{
											label: __('Assignments'),
											name: 'enforce_assignment_completion',
										},
										{
											label: __('Programming exercises'),
											name: 'enforce_programming_exercise_completion',
										},
									],
								},
								{
									label: __('Enforce passing'),
									name: 'enforce_passing',
									type: 'checkboxGroup',
									description: __(
										'The selected items must be passed, not just attempted.'
									),
									options: [
										{
											label: __('Quizzes'),
											name: 'enforce_quiz_passing',
											requires: 'enforce_quiz_completion',
										},
										{
											label: __('Open-ended quizzes'),
											name: 'enforce_open_ended_quiz_passing',
											requires: 'enforce_quiz_completion',
											caution: __(
												'The lesson completes only after an instructor grades it.'
											),
										},
										{
											label: __('Assignments'),
											name: 'enforce_assignment_passing',
											requires: 'enforce_assignment_completion',
											caution: __(
												'The lesson completes only after an instructor grades it.'
											),
										},
										{
											label: __('Programming exercises'),
											name: 'enforce_programming_exercise_passing',
											requires: 'enforce_programming_exercise_completion',
										},
									],
								},
								{
									label: __('Prevent Skipping Videos'),
									name: 'prevent_skipping_videos',
									type: 'checkbox',
									description: __(
										"Learners can't jump ahead of the furthest point they've watched. Turn on with Videos above to require watching the whole video."
									),
									caution: __(
										'This is not enforced for videos from Cloudflare Stream, Google Drive, Aparat or other embedded links.'
									),
								},
							],
						},
					],
				},
			},
			{
				label: __('Badges'),
				slug: 'badges',
				icon: 'lucide-award',
				records: true,
				page: badgesSettingsPage,
			},
			{
				label: __('Badge Assignments'),
				slug: 'badge-assignments',
				icon: 'lucide-badge-check',
				records: true,
				page: badgeAssignmentsSettingsPage,
			},
			{
				label: __('Categories'),
				slug: 'categories',
				icon: 'lucide-network',
				page: { kind: 'custom', component: markRaw(Categories) },
			},
		],
	},
	{
		label: __('Communication'),
		items: [
			{
				label: __('General'),
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
							label: __('Contact Information'),
							fields: [
								{
									label: __('Email'),
									name: 'contact_us_email',
									type: 'text',
									fullWidth: true,
								},
								{
									label: __('URL'),
									name: 'contact_us_url',
									type: 'text',
									fullWidth: true,
								},
							],
						},
						// Both override the notification rule's own wording. Shown
						// here so a site that set one can clear it.
						{
							label: __('Email Templates'),
							fields: [
								{
									label: __('Batch Confirmation Template'),
									name: 'batch_confirmation_template',
									type: 'link',
									doctype: 'Email Template',
									// CRM adds an `enabled` Check field to Email Template,
									// defaulting to disabled, and search_widget filters on
									// it unless told otherwise. See the `filters` doc comment.
									filters: { include_disabled: 1 },
									description: __(
										'Replaces the wording of the batch enrollment notification.'
									),
								},
								{
									label: __('Certificate Email Template'),
									name: 'certification_template',
									type: 'link',
									doctype: 'Email Template',
									filters: { include_disabled: 1 },
									description: __(
										'Replaces the wording of the certification notification.'
									),
								},
							],
						},
					],
					extra: { component: emailAccountDefaults },
				},
			},
			{
				label: __('Email Template'),
				slug: 'email-template',
				icon: 'lucide-mail-plus',
				records: true,
				page: emailTemplateSettingsPage,
			},
			{
				label: __('Email Accounts'),
				slug: 'email-accounts',
				icon: 'lucide-mail',
				records: true,
				page: emailAccountsPage,
			},
		],
	},
	{
		label: __('User Management'),
		items: [
			{
				label: __('Users'),
				slug: 'members',
				icon: 'lucide-user',
				records: true,
				page: membersSettingsPage,
			},
		],
	},
	{
		label: __('Payment'),
		items: [
			{
				label: __('Configuration'),
				slug: 'payments',
				icon: 'lucide-credit-card',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: __('Configuration'),
							fields: [
								{
									label: __('Default Currency'),
									name: 'default_currency',
									type: 'link',
									doctype: 'Currency',
									query: 'lms.lms.api.search_currencies',
									description: __(
										'Default currency used for course and batch pricing.'
									),
									// Shown, never written by being shown. Nothing on the
									// server resolves a blank default_currency: LMS Course's
									// desk form copies this value (blank included) into a new
									// course's currency, so the page must answer for itself.
									// USD is the app's reference currency already:
									// check_multicurrency converts into it and short-circuits.
									displayFallback: 'USD',
								},
								{
									label: __('Show USD equivalent amount'),
									name: 'show_usd_equivalent',
									type: 'checkbox',
									description: __(
										'If enabled, it shows the USD equivalent amount for all transactions based on the current exchange rate.'
									),
								},
								{
									label: __('Apply rounding on equivalent'),
									name: 'apply_rounding',
									type: 'checkbox',
									description: __(
										'If enabled, it applies rounding on the USD equivalent amount.'
									),
								},
								{
									label: __('Payment Gateway'),
									name: 'payment_gateway',
									type: 'link',
									doctype: 'Payment Gateway',
									description: __(
										'Payment gateway used to process course and batch purchases.'
									),
								},
								{
									label: __('Apply GST for India'),
									name: 'apply_gst',
									type: 'checkbox',
									description: __(
										'If enabled, GST will be applied to the price for students from India.'
									),
								},
							],
						},
						{
							label: __('Payment Reminders'),
							fields: [
								{
									label: __('Send payment reminders for batch'),
									name: 'send_payment_reminders_for_batch',
									type: 'checkbox',
									description: __(
										'If enabled, it sends payment reminders to students who left the payment incomplete for a batch.'
									),
								},
								{
									label: __('Send payment reminders for course'),
									name: 'send_payment_reminders_for_course',
									type: 'checkbox',
									description: __(
										'If enabled, it sends payment reminders to students who left the payment incomplete for a course.'
									),
								},
							],
						},
					],
				},
			},
			{
				label: __('Gateways'),
				slug: 'payment-gateways',
				icon: 'lucide-dollar-sign',
				records: true,
				page: { kind: 'custom', component: markRaw(PaymentGateways) },
			},
			{
				label: __('Transactions'),
				slug: 'transactions',
				icon: 'lucide-landmark',
				records: true,
				page: transactionsPage,
			},
			{
				label: __('Coupons'),
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
		label: __('Integrations'),
		items: [
			{
				label: __('Services'),
				slug: 'services',
				icon: 'lucide-key-round',
				page: { kind: 'custom', component: markRaw(Services) },
			},
			{
				label: __('Google Calendar'),
				slug: 'google-calendar',
				icon: 'lucide-calendar',
				records: true,
				condition: canManageGoogleIntegrations,
				page: googleCalendarSettingsPage,
			},
			{
				label: __('Google Meet'),
				slug: 'google-meet',
				icon: 'lucide-presentation',
				records: true,
				condition: canManageGoogleMeet,
				page: googleMeetSettingsPage,
			},
			{
				label: __('Zoom'),
				slug: 'zoom',
				icon: 'lucide-video',
				records: true,
				page: zoomSettingsPage,
			},
			{
				label: __('Raven'),
				slug: 'raven',
				icon: 'lucide-messages-square',
				page: { kind: 'custom', component: markRaw(RavenSettings) },
			},
		],
	},
	{
		label: __('Customization'),
		items: [
			{
				label: __('Branding'),
				slug: 'branding',
				icon: 'lucide-palette',
				page: { kind: 'custom', component: markRaw(BrandSettings) },
			},
			sidebarSettingsPage,
			{
				label: __('SEO'),
				slug: 'seo',
				icon: 'lucide-search',
				page: {
					kind: 'fields',
					source: { doc: 'LMS Settings' },
					save: 'auto',
					sections: [
						{
							label: __('SEO'),
							fields: [
								{
									label: __('Meta Description'),
									name: 'meta_description',
									type: 'textarea',
									rows: 4,
									description: __(
										"This description will be shown on lists and pages that don't have meta description"
									),
								},
								{
									label: __('Meta Keywords'),
									name: 'meta_keywords',
									type: 'textarea',
									rows: 4,
									description: __(
										'Comma separated keywords for search engines to find your website.'
									),
								},
								{
									label: __('Meta Image'),
									name: 'meta_image',
									type: 'upload',
									size: 'lg',
									// Open Graph image: unauthenticated crawlers fetch it.
									public: true,
									description: __(
										'Default social-share image used when pages lack their own meta image.'
									),
								},
							],
						},
					],
				},
			},
		],
	},
	{
		label: __('Frappe Cloud'),
		audience: hasCloudSettings,
		items: [
			{
				label: __('Billing'),
				slug: 'cloud-billing',
				icon: 'lucide-credit-card',
				page: { kind: 'custom', component: cloudPanel('billing') },
			},
			{
				label: __('Marketplace'),
				slug: 'cloud-marketplace',
				icon: 'lucide-store',
				page: { kind: 'custom', component: cloudPanel('marketplace') },
			},
			{
				label: __('Domains'),
				slug: 'cloud-domains',
				icon: 'lucide-globe',
				page: { kind: 'custom', component: cloudPanel('domains') },
			},
			{
				label: __('Advanced'),
				slug: 'cloud-advanced',
				icon: 'lucide-bolt',
				page: { kind: 'custom', component: cloudPanel('advanced') },
			},
		],
	},
]

export const isGroupVisible = (group: SettingsGroup): boolean =>
	group.audience
		? group.audience()
		: Boolean(usersStore().userResource.data?.is_moderator)

export const canOpenSettings = (): boolean => settingsTree.some(isGroupVisible)

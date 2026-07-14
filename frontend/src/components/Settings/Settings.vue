<template>
	<SettingsDialog v-model="show" v-model:tab="activeTab" size="5xl">
		<template #title>{{ __('Settings') }}</template>
		<SettingsSidebar>
			<SettingsNavGroup
				v-for="group in tabs"
				:key="group.label"
				:label="group.hideLabel ? undefined : __(group.label)"
			>
				<!-- CRM's sidebar type: xs-medium group headings, sm item labels.
				     Set on inner spans — the library's own text-base sits on the
				     wrapper and would otherwise win the cascade. -->
				<template #label>
					<span class="text-xs-medium text-ink-gray-5">
						{{ __(group.label) }}
					</span>
				</template>
				<SettingsNavItem
					v-for="item in group.items"
					:key="item.label"
					:value="item.label"
				>
					<template #prefix>
						<span :class="[item.icon, 'size-4 shrink-0 text-ink-gray-7']" />
					</template>
					<span class="text-sm text-ink-gray-8">{{ __(item.label) }}</span>
				</SettingsNavItem>
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent v-if="data.doc">
			<SettingsPanel
				v-for="item in items"
				:key="item.label"
				:value="item.label"
			>
				<component
					v-if="item.template"
					:is="item.template"
					v-bind="panelProps(item)"
				/>
				<SettingDetails
					v-else
					:sections="item.sections"
					:label="item.label"
					:description="item.description"
					:data="data"
				/>
			</SettingsPanel>
		</SettingsContent>
	</SettingsDialog>
</template>
<script setup>
import {
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsPanel,
	SettingsSidebar,
	createDocumentResource,
} from 'frappe-ui'
import { computed, markRaw, ref, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import SettingDetails from '@/components/Settings/SettingDetails.vue'
import Members from '@/components/Settings/Members.vue'
import Categories from '@/components/Settings/Categories.vue'
import EmailTemplatePage from '@/components/Settings/EmailTemplate/EmailTemplatePage.vue'
import EmailConfig from '@/components/Settings/EmailAccount/EmailConfig.vue'
import BrandSettings from '@/components/Settings/BrandSettings.vue'
import PaymentGateways from '@/components/Settings/PaymentGateways.vue'
import Coupons from '@/components/Settings/Coupons/Coupons.vue'
import Transactions from '@/components/Settings/Transactions/Transactions.vue'
import ZoomSettings from '@/components/Settings/ZoomSettings.vue'
import GoogleMeetSettings from '@/components/Settings/GoogleMeetSettings.vue'
import Badges from '@/components/Settings/Badges/Badges.vue'

const show = defineModel()
const doctype = ref('LMS Settings')
const activeTab = ref('')
const settingsStore = useSettings()

const data = createDocumentResource({
	doctype: doctype.value,
	name: doctype.value,
	fields: ['*'],
	cache: doctype.value,
	auto: true,
})

const tabsStructure = computed(() => {
	return [
		{
			label: 'Configuration',
			hideLabel: false,
			items: [
				{
					label: 'General',
					icon: 'lucide-wrench',
					description:
						'Configure system-wide defaults, notifications, and contact information',
					sections: [
						{
							label: 'System Configurations',
							columns: [
								{
									fields: [
										{
											label: 'Allow Guest Access',
											name: 'allow_guest_access',
											description:
												'If enabled, users can access the course and batch lists without logging in.',
											type: 'checkbox',
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
								{
									fields: [
										{
											label: 'Disable PWA',
											name: 'disable_pwa',
											type: 'checkbox',
											description:
												'If checked, users will not be able to install the application as a Progressive Web App.',
										},
										{
											label: 'Send calendar invite for evaluations',
											name: 'send_calendar_invite_for_evaluations',
											description:
												'If enabled, it sends google calendar invite to the student for evaluations.',
											type: 'checkbox',
										},
									],
								},
							],
						},
						{
							label: 'Notifications',
							columns: [
								{
									fields: [
										{
											label: 'Send Notification for Published Courses',
											name: 'send_notification_for_published_courses',
											type: 'select',
											options: [' ', 'Email', 'In-app'],
											description:
												'Notify members when a new course is published.',
										},
									],
								},
								{
									fields: [
										{
											label: 'Send Notification for Published Batches',
											name: 'send_notification_for_published_batches',
											type: 'select',
											options: [' ', 'Email', 'In-app'],
											description:
												'Notify members when a new batch is published.',
										},
									],
								},
							],
						},
						{
							label: 'Email Templates',
							columns: [
								{
									fields: [
										{
											label: 'Batch Confirmation Email Template',
											name: 'batch_confirmation_template',
											doctype: 'Email Template',
											type: 'Link',
											description:
												'Email template sent to students upon batch enrollment confirmation.',
										},
									],
								},
								{
									fields: [
										{
											label: 'Certification Email Template',
											name: 'certification_template',
											doctype: 'Email Template',
											type: 'Link',
											description:
												'Email template sent to students when they earn a certification.',
										},
									],
								},
							],
						},
						{
							label: 'Contact Information',
							columns: [
								{
									fields: [
										{
											label: 'Email',
											name: 'contact_us_email',
											type: 'text',
											description:
												'Users can reach out to this email for support or inquiries.',
										},
									],
								},
								{
									fields: [
										{
											label: 'URL',
											name: 'contact_us_url',
											type: 'text',
											description:
												'Users can reach out to this URL for support or inquiries.',
										},
									],
								},
							],
						},
						{
							label: 'Jobs',
							columns: [
								{
									fields: [
										{
											label: 'Allow Job Posting',
											name: 'allow_job_posting',
											type: 'checkbox',
											description:
												'If enabled, users can post job openings on the job board. Else only admins can post jobs.',
										},
									],
								},
								{
									fields: [],
								},
							],
						},
						{
							label: 'Integrations',
							columns: [
								{
									fields: [
										{
											label: 'Livecode URL',
											name: 'livecode_url',
											doctype: 'Livecode URL',
											type: 'text',
											description:
												'https://docs.frappe.io/learning/falcon-self-hosting-guide',
										},
									],
								},
								{
									fields: [
										{
											label: 'Unsplash Access Key',
											name: 'unsplash_access_key',
											description:
												'Allows users to pick a profile cover image from Unsplash. https://unsplash.com/documentation#getting-started.',
											type: 'password',
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'Course Progress',
					icon: 'lucide-activity',
					description:
						'Control how lessons are marked complete: dwell time and enforcement toggles for video, quiz, and assignment.',
					sections: [
						{
							label: 'Dwell Time',
							columns: [
								{
									fields: [
										{
											label: 'Lesson dwell time (seconds)',
											name: 'lesson_dwell_time',
											type: 'number',
											min: 1,
											description:
												'Seconds a learner must stay on a lesson before it auto-marks complete.',
										},
									],
								},
							],
						},
						{
							label: 'Enforcement',
							columns: [
								{
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
									],
								},
								{
									fields: [
										{
											label: 'Enforce quiz completion',
											name: 'enforce_quiz_completion',
											type: 'checkbox',
											description:
												'When enabled, lessons with a quiz cannot be marked complete until the quiz is submitted.',
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'Badges',
					description:
						'Create badges and assign them to students to acknowledge their achievements',
					icon: 'lucide-award',
					template: markRaw(Badges),
				},
				{
					label: 'Categories',
					description: 'Double click to edit the category',
					icon: 'lucide-network',
					template: markRaw(Categories),
				},
			],
		},
		{
			label: 'Email',
			items: [
				{
					label: 'Accounts',
					description: 'Manage email accounts for incoming and outgoing mail',
					icon: 'lucide-mail',
					template: markRaw(EmailConfig),
				},
				{
					label: 'Templates',
					description: 'Manage the email templates for your learning system',
					icon: 'lucide-mail-plus',
					template: markRaw(EmailTemplatePage),
				},
			],
		},
		{
			label: 'User Management',
			hideLabel: false,
			items: [
				{
					label: 'Users',
					description:
						'Manage users by adding or inviting them, and assign roles to control their access and permissions',
					icon: 'lucide-user',
					template: markRaw(Members),
				},
			],
		},
		{
			label: 'Payment',
			hideLabel: false,
			items: [
				{
					label: 'Configuration',
					icon: 'lucide-credit-card',
					description: 'Manage all your payment related settings and defaults',
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: 'Default Currency',
											name: 'default_currency',
											type: 'Link',
											doctype: 'Currency',
											description:
												'Default currency used for course and batch pricing.',
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
									],
								},
								{
									fields: [
										{
											label: 'Payment Gateway',
											name: 'payment_gateway',
											type: 'Link',
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
							],
						},
						{
							label: 'Payment Reminders',
							columns: [
								{
									fields: [
										{
											label: 'Send payment reminders for batch',
											name: 'send_payment_reminders_for_batch',
											type: 'checkbox',
											description:
												'If enabled, it sends payment reminders to students who left the payment incomplete for a batch.',
										},
									],
								},
								{
									fields: [
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
					],
				},
				{
					label: 'Gateways',
					icon: 'lucide-dollar-sign',
					template: markRaw(PaymentGateways),
					description: 'Add and manage all your payment gateways',
				},
				{
					label: 'Transactions',
					icon: 'lucide-landmark',
					template: markRaw(Transactions),
					description: 'View all your payment transactions',
				},
				{
					label: 'Coupons',
					icon: 'lucide-ticket',
					template: markRaw(Coupons),
					description: 'Manage discount coupons for courses and batches',
				},
			],
		},
		{
			label: 'Conferencing',
			hideLabel: false,
			items: [
				{
					label: 'Zoom',
					description:
						'Manage zoom accounts to conduct live classes from batches',
					icon: 'lucide-video',
					template: markRaw(ZoomSettings),
				},
				{
					label: 'Google Meet',
					description:
						'Manage Google Meet accounts to conduct live classes from batches',
					icon: 'lucide-presentation',
					template: markRaw(GoogleMeetSettings),
				},
			],
		},
		{
			label: 'Customize',
			hideLabel: false,
			items: [
				{
					label: 'Branding',
					icon: 'lucide-palette',
					description:
						'Customize the brand name and logo to make the application your own',
					template: markRaw(BrandSettings),
				},
				{
					label: 'Sidebar',
					icon: 'lucide-panel-left',
					description: 'Choose the items you want to show in the sidebar',
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: 'Courses',
											name: 'courses',
											type: 'checkbox',
											description: 'Show the Courses link in the sidebar.',
										},
										{
											label: 'Batches',
											name: 'batches',
											type: 'checkbox',
											description: 'Show the Batches link in the sidebar.',
										},
										{
											label: 'Programming Exercises',
											name: 'programming_exercises',
											type: 'checkbox',
											description:
												'Show the Programming Exercises link in the sidebar.',
										},
										{
											label: 'Certifications',
											name: 'certifications',
											type: 'checkbox',
											description:
												'Show the Certifications link in the sidebar.',
										},
									],
								},
								{
									fields: [
										{
											label: 'Jobs',
											name: 'jobs',
											type: 'checkbox',
											description: 'Show the Jobs link in the sidebar.',
										},
										{
											label: 'Statistics',
											name: 'statistics',
											type: 'checkbox',
											description: 'Show the Statistics link in the sidebar.',
										},
										{
											label: 'Notifications',
											name: 'notifications',
											type: 'checkbox',
											description:
												'Show the Notifications link in the sidebar.',
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'Signup',
					icon: 'lucide-log-in',
					description:
						'Manage the settings related to user signup and registration',
					sections: [
						{
							columns: [
								{
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
											type: 'Code',
											mode: 'htmlmixed',
											rows: 10,
											description:
												'Custom HTML shown on the signup page, e.g. for consent notices or terms of service.',
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'SEO',
					icon: 'lucide-search',
					description:
						'Manage the SEO settings to improve your website ranking on search engines',
					sections: [
						{
							columns: [
								{
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
											type: 'Upload',
											size: 'lg',
											description:
												'Default social-share image used when pages lack their own meta image.',
										},
									],
								},
							],
						},
					],
				},
			],
		},
	]
})

const items = computed(() => tabs.value.flatMap((group) => group.items))

// Members and Transactions own dialogs of their own and need to close Settings.
const panelProps = (item) => ({
	label: item.label,
	description: item.description,
	...(['Users', 'Transactions'].includes(item.label)
		? { 'onUpdate:show': (val) => (show.value = val), show: show.value }
		: {}),
})

const tabs = computed(() => {
	return tabsStructure.value.map((tab) => {
		return {
			...tab,
			items: tab.items.filter((item) => {
				return !item.condition || item.condition()
			}),
		}
	})
})

watch(show, () => {
	if (show.value) {
		const stored = items.value.find(
			(item) => item.label === settingsStore.activeTab
		)
		activeTab.value = (stored || items.value[0]).label
	} else {
		activeTab.value = ''
		settingsStore.isSettingsOpen = false
	}
})
</script>

<template>
	<Dialog v-model:open="show" size="5xl">
		<template #body>
			<div class="flex h-[calc(100vh_-_8rem)]">
				<div
					class="flex w-52 shrink-0 flex-col bg-surface-gray-2 p-2 overflow-y-auto"
				>
					<h1 class="mb-3 px-2 pt-2 text-xl-semibold text-ink-gray-9">
						{{ __('Settings') }}
					</h1>
					<div class="space-y-5">
						<div v-for="tab in tabs" :key="tab.label">
							<div
								v-if="!tab.hideLabel"
								class="mb-2 mt-3 flex cursor-pointer gap-1.5 px-1 text-base text-ink-gray-5 transition-all duration-300 ease-in-out"
							>
								<span>{{ __(tab.label) }}</span>
							</div>
							<nav class="space-y-1">
								<div v-for="item in tab.items" @click="activeTab = item">
									<SidebarLink
										:link="item"
										:key="item.label"
										:activeTab="activeTab?.label"
									/>
								</div>
							</nav>
						</div>
					</div>
				</div>
				<div
					v-if="activeTab && data.doc"
					:key="activeTab.label"
					class="flex flex-1 flex-col bg-surface-elevation-2 overflow-hidden"
				>
					<component
						v-if="activeTab.template"
						:is="activeTab.template"
						v-bind="{
							label: activeTab.label,
							description: activeTab.description,
							...(activeTab.label == 'Members' ||
							activeTab.label == 'Transactions'
								? { 'onUpdate:show': (val) => (show = val), show }
								: {}),
						}"
					/>
					<SettingDetails
						v-else
						:sections="activeTab.sections"
						:label="activeTab.label"
						:description="activeTab.description"
						:data="data"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, createDocumentResource } from 'frappe-ui'
import { computed, markRaw, ref, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import SettingDetails from '@/components/Settings/SettingDetails.vue'
import SidebarLink from '@/components/Sidebar/SidebarLink.vue'
import Members from '@/components/Settings/Members.vue'
import Categories from '@/components/Settings/Categories.vue'
import EmailTemplates from '@/components/Settings/EmailTemplates.vue'
import BrandSettings from '@/components/Settings/BrandSettings.vue'
import PaymentGateways from '@/components/Settings/PaymentGateways.vue'
import Coupons from '@/components/Settings/Coupons/Coupons.vue'
import Transactions from '@/components/Settings/Transactions/Transactions.vue'
import ZoomSettings from '@/components/Settings/ZoomSettings.vue'
import GoogleMeetSettings from '@/components/Settings/GoogleMeetSettings.vue'
import Badges from '@/components/Settings/Badges.vue'

const show = defineModel()
const doctype = ref('LMS Settings')
const activeTab = ref(null)
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
			hideLabel: true,
			items: [
				{
					label: 'General',
					icon: 'Wrench',
					description:
						'Configure system-wide defaults, notifications, and contact information',
					sections: [
						{
							label: __('System Configurations'),
							columns: [
								{
									fields: [
										{
											label: __('Allow Guest Access'),
											name: 'allow_guest_access',
											description:
												'If enabled, users can access the course and batch lists without logging in.',
											type: 'checkbox',
										},
										{
											label: __('Prevent Skipping Videos'),
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
											label: __('Disable PWA'),
											name: 'disable_pwa',
											type: 'checkbox',
											description:
												'If checked, users will not be able to install the application as a Progressive Web App.',
										},
										{
											label: __('Send calendar invite for evaluations'),
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
											label: __('Send Notification for Published Courses'),
											name: 'send_notification_for_published_courses',
											type: 'select',
											options: [' ', 'Email', 'In-app'],
											description:
												__('Notify members when a new course is published.'),
										},
									],
								},
								{
									fields: [
										{
											label: __('Send Notification for Published Batches'),
											name: 'send_notification_for_published_batches',
											type: 'select',
											options: [' ', 'Email', 'In-app'],
											description:
												__('Notify members when a new batch is published.'),
										},
									],
								},
							],
						},
						{
							label: __('Email Templates'),
							columns: [
								{
									fields: [
										{
											label: __('Batch Confirmation Email Template'),
											name: 'batch_confirmation_template',
											doctype: 'Email Template',
											type: 'Link',
											description:
												__('Email template sent to students upon batch enrollment confirmation.'),
										},
									],
								},
								{
									fields: [
										{
											label: __('Certification Email Template'),
											name: 'certification_template',
											doctype: 'Email Template',
											type: 'Link',
											description:
												__('Email template sent to students when they earn a certification.'),
										},
									],
								},
							],
						},
						{
							label: __('Contact Information'),
							columns: [
								{
									fields: [
										{
											label: 'Email',
											name: 'contact_us_email',
											type: 'text',
											description:
												__('Users can reach out to this email for support or inquiries.'),
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
												__('Users can reach out to this URL for support or inquiries.'),
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
											label: __('Allow Job Posting'),
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
											label: __('Unsplash Access Key'),
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
					label: __('Course Progress'),
					icon: 'Activity',
					description:
						'Control how lessons are marked complete: dwell time and enforcement toggles for video, quiz, and assignment.',
					sections: [
						{
							label: __('Dwell Time'),
							columns: [
								{
									fields: [
										{
											label: 'Lesson dwell time (seconds)',
											name: 'lesson_dwell_time',
											type: 'number',
											min: 1,
											description:
												__('Seconds a learner must stay on a lesson before it auto-marks complete.'),
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
						__('Create badges and assign them to students to acknowledge their achievements'),
					icon: 'Award',
					template: markRaw(Badges),
				},
				{
					label: 'Categories',
					description: __('Double click to edit the category'),
					icon: 'Network',
					template: markRaw(Categories),
				},
				{
					label: __('Email Templates'),
					description: __('Manage the email templates for your learning system'),
					icon: 'MailPlus',
					template: markRaw(EmailTemplates),
				},
			],
		},
		{
			label: 'Users',
			hideLabel: false,
			items: [
				{
					label: 'Members',
					description:
						__('Add new members or manage roles and permissions of existing members'),
					icon: 'User',
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
					icon: 'CreditCard',
					description: __('Manage all your payment related settings and defaults'),
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: __('Default Currency'),
											name: 'default_currency',
											type: 'Link',
											doctype: 'Currency',
											description:
												__('Default currency used for course and batch pricing.'),
										},
										{
											label: __('Show USD equivalent amount'),
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
											label: __('Payment Gateway'),
											name: 'payment_gateway',
											type: 'Link',
											doctype: 'Payment Gateway',
											description:
												__('Payment gateway used to process course and batch purchases.'),
										},
										{
											label: __('Apply GST for India'),
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
							label: __('Payment Reminders'),
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
					icon: 'DollarSign',
					template: markRaw(PaymentGateways),
					description: __('Add and manage all your payment gateways'),
				},
				{
					label: 'Transactions',
					icon: 'Landmark',
					template: markRaw(Transactions),
					description: __('View all your payment transactions'),
				},
				{
					label: 'Coupons',
					icon: 'Ticket',
					template: markRaw(Coupons),
					description: __('Manage discount coupons for courses and batches'),
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
						__('Manage zoom accounts to conduct live classes from batches'),
					icon: 'Video',
					template: markRaw(ZoomSettings),
				},
				{
					label: __('Google Meet'),
					description:
						__('Manage Google Meet accounts to conduct live classes from batches'),
					icon: 'Presentation',
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
					icon: 'Blocks',
					description:
						__('Customize the brand name and logo to make the application your own'),
					template: markRaw(BrandSettings),
				},
				{
					label: 'Sidebar',
					icon: 'PanelLeftIcon',
					description: __('Choose the items you want to show in the sidebar'),
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: 'Courses',
											name: 'courses',
											type: 'checkbox',
											description: __('Show the Courses link in the sidebar.'),
										},
										{
											label: 'Batches',
											name: 'batches',
											type: 'checkbox',
											description: __('Show the Batches link in the sidebar.'),
										},
										{
											label: __('Programming Exercises'),
											name: 'programming_exercises',
											type: 'checkbox',
											description:
												__('Show the Programming Exercises link in the sidebar.'),
										},
										{
											label: 'Certifications',
											name: 'certifications',
											type: 'checkbox',
											description:
												__('Show the Certifications link in the sidebar.'),
										},
									],
								},
								{
									fields: [
										{
											label: 'Jobs',
											name: 'jobs',
											type: 'checkbox',
											description: __('Show the Jobs link in the sidebar.'),
										},
										{
											label: 'Statistics',
											name: 'statistics',
											type: 'checkbox',
											description: __('Show the Statistics link in the sidebar.'),
										},
										{
											label: 'Notifications',
											name: 'notifications',
											type: 'checkbox',
											description:
												__('Show the Notifications link in the sidebar.'),
										},
									],
								},
							],
						},
					],
				},
				{
					label: 'Signup',
					icon: 'LogIn',
					description:
						__('Manage the settings related to user signup and registration'),
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: __('Identify User Category'),
											name: 'user_category',
											type: 'checkbox',
											description:
												__('Enable this option to identify the user category during signup.'),
										},
										{
											label: 'Disable signup',
											name: 'disable_signup',
											type: 'checkbox',
											description:
												__('New users will have to be manually registered by Admins.'),
										},
										{
											label: __('Signup Consent HTML'),
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
					icon: 'Search',
					description:
						__('Manage the SEO settings to improve your website ranking on search engines'),
					sections: [
						{
							columns: [
								{
									fields: [
										{
											label: __('Meta Description'),
											name: 'meta_description',
											type: 'textarea',
											rows: 4,
											description:
												"This description will be shown on lists and pages that don't have meta description",
										},
										{
											label: __('Meta Keywords'),
											name: 'meta_keywords',
											type: 'textarea',
											rows: 4,
											description:
												__('Comma separated keywords for search engines to find your website.'),
										},
										{
											label: __('Meta Image'),
											name: 'meta_image',
											type: 'Upload',
											size: 'lg',
											description:
												__('Default social-share image used when pages lack their own meta image.'),
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

watch(show, async () => {
	if (show.value) {
		const currentTab = await tabs.value
			.flatMap((tab) => tab.items)
			.find((item) => item.label === settingsStore.activeTab)
		activeTab.value = currentTab || tabs.value[0].items[0]
	} else {
		activeTab.value = null
		settingsStore.isSettingsOpen = false
	}
})
</script>

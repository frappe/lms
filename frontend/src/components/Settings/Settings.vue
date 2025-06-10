<template>
	<Dialog v-model="show" :options="{ size: '5xl' }">
		<template #body>
			<div class="flex h-[calc(100vh_-_8rem)]">
				<div class="flex w-52 shrink-0 flex-col bg-surface-gray-2 p-2">
					<h1 class="mb-3 px-2 pt-2 text-lg font-semibold text-ink-gray-9">
						{{ __('Settings') }}
					</h1>
					<div v-for="tab in tabs" :key="tab.label">
						<div
							v-if="!tab.hideLabel"
							class="mb-2 mt-3 flex cursor-pointer gap-1.5 px-1 text-base font-medium text-ink-gray-5 transition-all duration-300 ease-in-out"
						>
							<span>{{ __(tab.label) }}</span>
						</div>
						<nav class="space-y-1">
							<SidebarLink
								v-for="item in tab.items"
								:link="item"
								:key="item.label"
								class="w-full"
								:class="
									activeTab?.label == item.label
										? 'bg-surface-selected shadow-sm'
										: 'hover:bg-surface-gray-2'
								"
								@click="activeTab = item"
							/>
						</nav>
					</div>
				</div>
				<div
					v-if="activeTab && data.doc"
					:key="activeTab.label"
					class="flex flex-1 flex-col px-10 py-8 bg-surface-modal"
				>
					<Members
						v-if="activeTab.label === 'Members'"
						:label="activeTab.label"
						:description="activeTab.description"
						v-model:show="show"
					/>
					<Evaluators
						v-else-if="activeTab.label === 'Evaluators'"
						:label="activeTab.label"
						:description="activeTab.description"
						v-model:show="show"
					/>
					<Categories
						v-else-if="activeTab.label === 'Categories'"
						:label="activeTab.label"
						:description="activeTab.description"
					/>
					<EmailTemplates
						v-else-if="activeTab.label === 'Email Templates'"
						:label="activeTab.label"
						:description="activeTab.description"
					/>
					<ZoomSettings
						v-else-if="activeTab.label === 'Zoom Accounts'"
						:label="activeTab.label"
						:description="activeTab.description"
					/>
					<PaymentSettings
						v-else-if="activeTab.label === 'Payment Gateway'"
						:label="activeTab.label"
						:description="activeTab.description"
						:data="data"
						:fields="activeTab.fields"
					/>
					<BrandSettings
						v-else-if="activeTab.label === 'Branding'"
						:label="activeTab.label"
						:description="activeTab.description"
						:fields="activeTab.fields"
						:data="branding"
					/>
					<SettingDetails
						v-else
						:fields="activeTab.fields"
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
import { Dialog, createDocumentResource, createResource } from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import SettingDetails from '@/components/Settings/SettingDetails.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import Members from '@/components/Settings/Members.vue'
import Evaluators from '@/components/Settings/Evaluators.vue'
import Categories from '@/components/Settings/Categories.vue'
import EmailTemplates from '@/components/Settings/EmailTemplates.vue'
import BrandSettings from '@/components/Settings/BrandSettings.vue'
import PaymentSettings from '@/components/Settings/PaymentSettings.vue'
import ZoomSettings from '@/components/Settings/ZoomSettings.vue'

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

const branding = createResource({
	url: 'lms.lms.api.get_branding',
	auto: true,
	cache: 'brand',
})

const tabsStructure = computed(() => {
	return [
		{
			label: 'Settings',
			hideLabel: true,
			items: [
				{
					label: 'General',
					icon: 'Wrench',
					fields: [
						{
							label: 'Enable Learning Paths',
							name: 'enable_learning_paths',
							description:
								'This will ensure students follow the assigned programs in order.',
							type: 'checkbox',
						},
						{
							label: 'Allow Guest Access',
							name: 'allow_guest_access',
							description:
								'If enabled, users can access the course and batch lists without logging in.',
							type: 'checkbox',
						},
						{
							label: 'Send calendar invite for evaluations',
							name: 'send_calendar_invite_for_evaluations',
							description:
								'If enabled, it sends google calendar invite to the student for evaluations.',
							type: 'checkbox',
						},
						{
							type: 'Column Break',
						},
						{
							label: 'Batch Confirmation Email Template',
							name: 'batch_confirmation_template',
							doctype: 'Email Template',
							type: 'Link',
						},
						{
							label: 'Certification Email Template',
							name: 'certification_template',
							doctype: 'Email Template',
							type: 'Link',
						},
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
		{
			label: 'Settings',
			hideLabel: true,
			items: [
				{
					label: 'Payment Gateway',
					icon: 'DollarSign',
					description:
						'Configure the payment gateway and other payment related settings',
					fields: [
						{
							label: 'Default Currency',
							name: 'default_currency',
							type: 'Link',
							doctype: 'Currency',
						},
						{
							label: 'Payment Gateway',
							name: 'payment_gateway',
							type: 'Link',
							doctype: 'Payment Gateway',
						},
						{
							type: 'Column Break',
						},
						{
							label: 'Apply GST for India',
							name: 'apply_gst',
							type: 'checkbox',
						},
						{
							label: 'Show USD equivalent amount',
							name: 'show_usd_equivalent',
							type: 'checkbox',
						},
						{
							label: 'Apply rounding on equivalent',
							name: 'apply_rounding',
							type: 'checkbox',
						},
					],
				},
			],
		},
		{
			label: 'Lists',
			hideLabel: false,
			items: [
				{
					label: 'Members',
					description: 'Manage the members of your learning system',
					icon: 'UserRoundPlus',
				},
				{
					label: 'Evaluators',
					description: 'Manage the evaluators of your learning system',
					icon: 'UserCheck',
				},
				{
					label: 'Categories',
					description: 'Double click to edit the category',
					icon: 'Network',
				},
				{
					label: 'Email Templates',
					description: 'Manage the email templates for your learning system',
					icon: 'MailPlus',
				},
				{
					label: 'Zoom Accounts',
					description: 'Manage the Zoom accounts for your learning system',
					icon: 'Video',
				},
			],
		},
		{
			label: 'Customise',
			hideLabel: false,
			items: [
				{
					label: 'Branding',
					icon: 'Blocks',
					fields: [
						{
							label: 'Brand Name',
							name: 'app_name',
							type: 'text',
						},
						{
							label: 'Logo',
							name: 'banner_image',
							type: 'Upload',
						},
						{
							label: 'Favicon',
							name: 'favicon',
							type: 'Upload',
						},
					],
				},
				{
					label: 'Sidebar',
					icon: 'PanelLeftIcon',
					description: 'Choose the items you want to show in the sidebar',
					fields: [
						{
							label: 'Courses',
							name: 'courses',
							type: 'checkbox',
						},
						{
							label: 'Batches',
							name: 'batches',
							type: 'checkbox',
						},
						{
							label: 'Certified Members',
							name: 'certified_members',
							type: 'checkbox',
						},
						{
							type: 'Column Break',
						},
						{
							label: 'Jobs',
							name: 'jobs',
							type: 'checkbox',
						},
						{
							label: 'Statistics',
							name: 'statistics',
							type: 'checkbox',
						},
						{
							label: 'Notifications',
							name: 'notifications',
							type: 'checkbox',
						},
					],
				},
				{
					label: 'Signup',
					icon: 'LogIn',
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
							type: 'Column Break',
						},
						{
							label: 'Signup Consent HTML',
							name: 'custom_signup_content',
							type: 'Code',
							mode: 'htmlmixed',
							rows: 10,
						},
					],
				},
				{
					label: 'SEO',
					icon: 'Search',
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
							type: 'Column Break',
						},
						{
							label: 'Meta Image',
							name: 'meta_image',
							type: 'Upload',
							size: 'lg',
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

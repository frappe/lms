<template>
	<SettingsDialog v-model="show" v-model:tab="activeTab" size="5xl">
		<template #title>{{ __('Settings') }}</template>
		<SettingsSidebar>
			<SettingsNavGroup
				v-for="group in tabs"
				:key="group.label"
				:label="group.hideLabel ? undefined : __(group.label)"
			>
				<template #label>
					<span class="text-p-xs-medium text-ink-gray-5">
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
					<span class="text-p-sm text-ink-gray-7">{{ __(item.label) }}</span>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import SettingDetails from '@/components/Settings/SettingDetails.vue'
import { settingsStructure } from '@/components/Settings/settingsStructure.js'

const show = defineModel()
const doctype = ref('LMS Settings')
const activeTab = ref('')
const settingsStore = useSettings()

// Tells openSettings there is something here to open. Nothing mounts this on a
// phone, and a moderator asking for Settings from a routed form there would
// otherwise have their form closed for a dialog that never appeared.
onMounted(() => {
	settingsStore.isSettingsMounted = true
})
onBeforeUnmount(() => {
	settingsStore.isSettingsMounted = false
})

const data = createDocumentResource({
	doctype: doctype.value,
	name: doctype.value,
	fields: ['*'],
	cache: doctype.value,
	auto: true,
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
	return settingsStructure.map((tab) => {
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

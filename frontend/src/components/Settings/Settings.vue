<template>
	<SettingsDialog v-model:open="show" v-model:tab="activeTab" size="5xl">
		<template #title>{{ __('Settings') }}</template>
		<SettingsSidebar>
			<SettingsNavGroup v-for="group in tabs" :key="group.label">
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
		<SettingsContent v-if="data.doc" class="min-w-0">
			<SettingsPanel
				v-for="item in items"
				:key="item.label"
				:value="item.label"
				class="min-w-0"
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
		<Dialog.Close as-child>
			<Button
				class="absolute end-1 top-1 z-30"
				variant="ghost"
				:label="__('Close')"
			>
				<template #icon>
					<span class="lucide-x size-4 text-ink-gray-9" />
				</template>
			</Button>
		</Dialog.Close>
	</SettingsDialog>
</template>
<script setup>
import {
	Button,
	Dialog,
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
<<<<<<< HEAD
import SettingDetails from '@/components/Settings/SettingDetails.vue'
import { settingsStructure } from '@/components/Settings/settingsStructure.js'
=======
import DiscardChangesDialog from '@/components/Settings/DiscardChangesDialog.vue'
import { confirmDiscard, installDirtyGuard } from '@/composables/useDirtyGuard'
import SettingsFieldsPanel from '@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue'
import SettingsListPanel from '@/components/Layouts/settings/desktop/SettingsListPanel.vue'
import { isGroupVisible, settingsTree } from '@/components/Settings/settings'
import { useSettingsHash } from '@/composables/useSettingsHash'
>>>>>>> 75d6477 (feat(cloud-settings): show frappe cloud panels in settings)

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
<<<<<<< HEAD
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
=======
	return settingsTree
		.filter(isGroupVisible)
		.map((tab) => {
			return {
				...tab,
				items: tab.items.filter((item) => {
					return !item.condition || item.condition()
				}),
			}
		})
		.filter((tab) => tab.items.length)
})

const {
	items,
	isOpen,
	activeTab,
	activeRecord,
	selectTab,
	selectRecord,
	replaceRecord,
	close,
} = useSettingsHash(tabs)

// The hash owns the dialog: it is open because the URL says so, and dismissing
// it navigates rather than flipping a flag no one else can see.
const show = computed({
	get: () => isOpen.value,
	set: (value) => {
		if (!value && !isCloudOverlayOpen()) close()
	},
})

// A Cloud panel's menus and dialogs live in a shadow root the dialog can't
// see, so their Esc and outside clicks would close Settings too
const isCloudOverlayOpen = () =>
	!!document.querySelector('fc-cloud-settings[overlay-open]')

// Panels are keyed by slug, so this is what the nav emits back on a click.
const activeSlug = computed({
	get: () => activeTab.value?.slug ?? '',
	set: (slug) => {
		selectTab(items.value.find((item) => item.slug === slug) ?? null)
	},
})

// The hash owns the open record too, so a panel's model reads and writes
// it. Each panel gets only its own tab's record: unmounting a hidden panel
// isn't guaranteed, so a still-mounted panel must not adopt another tab's.
const recordFor = (item) =>
	activeTab.value?.slug === item.slug ? activeRecord.value : null

const openRecord = (item, record) => {
	if (activeTab.value?.slug !== item.slug) return
	selectRecord(record)
}

// A custom page that owns records gets the same pair a list panel does:
// the record it's on, and a way to say it moved. Bound only where the item
// declares `records`, since an undeclared listener falls through as an
// attribute, and Vue warns about that on components that render a fragment.
const recordModel = (item) =>
	item.records
		? {
				record: recordFor(item),
				'onUpdate:record': (record) => openRecord(item, record),
		  }
		: {}

// A renamed record is the same record under a new name, so its hash entry
// is rewritten rather than a second one pushed, keeping Back intact.
// Otherwise a refresh deep-links to a document the server has forgotten.
const renameRecord = (item, name) => {
	if (activeTab.value?.slug !== item.slug) return
	replaceRecord(name)
}
>>>>>>> 75d6477 (feat(cloud-settings): show frappe cloud panels in settings)
</script>

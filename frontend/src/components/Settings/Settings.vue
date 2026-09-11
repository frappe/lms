<template>
	<SettingsDialog v-model="show" v-model:tab="activeSlug" size="5xl">
		<template #title>{{ __('Settings') }}</template>
		<SettingsSidebar>
			<SettingsNavGroup
				v-for="group in tabs"
				:key="group.label"
				:label="group.hideLabel ? undefined : __(group.label)"
			>
				<template #label>
					<span class="text-xs-medium text-ink-gray-5">
						{{ __(group.label) }}
					</span>
				</template>
				<SettingsNavItem
					v-for="item in group.items"
					:key="item.slug"
					:value="item.slug"
				>
					<template #prefix>
						<span :class="[item.icon, 'size-4 shrink-0 text-ink-gray-7']" />
					</template>
					<span class="text-p-sm text-ink-gray-7">{{ __(item.label) }}</span>
				</SettingsNavItem>
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent ref="content">
			<SettingsPanel v-for="item in items" :key="item.slug" :value="item.slug">
				<SettingsFieldsPanel
					v-if="item.page.kind === 'fields'"
					:page="item.page"
					:title="__(item.label)"
					:data="sharedDocument(item.page)"
				/>
				<SettingsListPanel
					v-else-if="item.page.kind === 'list'"
					:page="item.page"
					:title="__(item.label)"
					:record="recordFor(item)"
					@update:record="(record) => openRecord(item, record)"
					@renamed="(name) => renameRecord(item, name)"
				/>
				<component
					v-else
					:is="item.page.component"
					:label="item.label"
					v-bind="recordModel(item)"
				/>
			</SettingsPanel>
		</SettingsContent>
		<Button
			class="absolute end-1 top-1 z-30"
			variant="ghost"
			:label="__('Close')"
			@click="show = false"
		>
			<template #icon>
				<span class="lucide-x size-4 text-ink-gray-9" />
			</template>
		</Button>
	</SettingsDialog>
	<DiscardChangesDialog />
</template>
<script setup>
import {
	Button,
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsPanel,
	SettingsSidebar,
	createDocumentResource,
} from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '@/stores/settings'
import DiscardChangesDialog from '@/components/Settings/DiscardChangesDialog.vue'
import { confirmDiscard, installDirtyGuard } from '@/composables/useDirtyGuard'
import SettingsFieldsPanel from '@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue'
import SettingsListPanel from '@/components/Layouts/settings/desktop/SettingsListPanel.vue'
import { settingsTree } from '@/components/Settings/settings'
import { useSettingsHash } from '@/composables/useSettingsHash'

const doctype = ref('LMS Settings')
const settingsStore = useSettings()

// The dirty guard, installed once for every settings form. Each form
// registers its own check; this is the single router hook that consults
// them, and must be removed on unmount or a remount would prompt twice.
const router = useRouter()
let removeDirtyGuard = null

// Tells openSettings there is something here to open. Nothing mounts this on a
// phone, and a moderator asking for Settings from a routed form there would
// otherwise have their form closed for a dialog that never appeared.
onMounted(() => {
	settingsStore.isSettingsMounted = true
	removeDirtyGuard = installDirtyGuard(router, confirmDiscard)
})
onBeforeUnmount(() => {
	settingsStore.isSettingsMounted = false
	removeDirtyGuard?.()
	removeDirtyGuard = null
})

// The panel area is not gated on this document: only some pages write it,
// a list of Zoom accounts does not, and the ones that do already wait for
// their own source to load, so gating here only blanked the rest.
const data = createDocumentResource({
	doctype: doctype.value,
	name: doctype.value,
	fields: ['*'],
	cache: doctype.value,
	auto: true,
})

// Handed down so a page over this document does not enter it a second time.
// A page over any other doctype gets nothing: passing it would hand a Zoom
// account form the wrong document to write.
const sharedDocument = (page) =>
	'doc' in page.source && page.source.doc === doctype.value ? data : undefined

const tabs = computed(() => {
	return settingsTree.map((tab) => {
		return {
			...tab,
			items: tab.items.filter((item) => {
				return !item.condition || item.condition()
			}),
		}
	})
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
		if (!value) close()
	},
})

// Dismissing on a backdrop click, which frappe-ui's dialog stack loses:
// reka-ui reads an outside click off a document-level `pointerdown`, and
// frappe-ui's `@pointerdown.stop` on the dialog content keeps that handler
// from ever seeing one, so one click in the panel and reka swallows the
// next backdrop click instead of dismissing. The overlay is the exact
// surface for this fix: a panel click is stopped before it gets here.
const content = ref(null)
const dialogContent = computed(
	() => content.value?.$el?.closest('[data-dismissable-layer]') ?? null
)
const dialogOverlay = computed(
	() => dialogContent.value?.closest('.dialog-overlay') ?? null
)

watch(
	dialogOverlay,
	(overlay, _previous, onCleanup) => {
		if (!overlay) return
		const dismiss = (event) => {
			if (dialogContent.value?.contains(event.target)) return
			event.stopPropagation()
			show.value = false
		}
		overlay.addEventListener('pointerdown', dismiss)
		onCleanup(() => overlay.removeEventListener('pointerdown', dismiss))
	},
	{ immediate: true }
)

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
</script>

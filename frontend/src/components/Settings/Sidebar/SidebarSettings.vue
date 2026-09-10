<template>
	<SettingsLayout
		:title="__(label)"
		:description="
			__('Choose which links appear in the sidebar, and in what order.')
		"
	>
		<template #header-actions>
			<Button
				data-testid="new-sidebar-link"
				variant="solid"
				:label="__('New')"
				@click="openModal(null)"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
			</Button>
		</template>

		<div data-testid="sidebar-panel">
			<div class="overflow-hidden rounded border border-outline-elevation-2">
				<div
					data-testid="sidebar-grid-header"
					class="flex items-center bg-surface-gray-2 text-p-sm text-ink-gray-5"
				>
					<div class="h-8 w-8 shrink-0 border-e border-outline-gray-2" />
					<div
						data-testid="sidebar-grid-columns"
						class="grid h-8 min-w-0 flex-1 items-center"
						:style="{ gridTemplateColumns }"
					>
						<div class="truncate border-e border-outline-gray-2 px-2">
							{{ __('Item') }}
						</div>
						<div class="truncate border-e border-outline-gray-2 px-2">
							{{ __('Type') }}
						</div>
						<div class="truncate border-e border-outline-gray-2 px-2">
							{{ __('Target') }}
						</div>
						<div class="truncate border-e border-outline-gray-2 px-2">
							{{ __('Visible') }}
						</div>
						<div class="truncate px-2" />
					</div>
				</div>

				<Draggable
					v-model="rows"
					item-key="_clientId"
					handle="[data-drag-handle]"
					:move="onMove"
					class="w-full"
					@end="persist()"
				>
					<template #item="{ element }">
						<div
							class="flex items-center border-b border-outline-elevation-2 bg-surface-base last:border-b-0"
						>
							<div
								class="inline-flex h-9 w-8 shrink-0 items-center justify-center border-e border-outline-gray-2"
							>
								<span
									v-if="!element.is_standard"
									:ref="
										(el) => setHandleRef(element._clientId, el as Element | null)
									"
									:data-testid="`drag-${element._clientId}`"
									data-drag-handle
									tabindex="0"
									role="button"
									:aria-label="dragHandleLabel(element)"
									class="lucide-grip-vertical size-4 cursor-grab rounded text-ink-gray-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
									@keydown.up.prevent="moveRow(element, -1)"
									@keydown.down.prevent="moveRow(element, 1)"
								/>
							</div>
							<div
								class="grid h-9 min-w-0 flex-1 items-center"
								:style="{ gridTemplateColumns }"
							>
								<div
									class="flex h-9 min-w-0 items-center gap-2 border-e border-outline-gray-2 px-2"
								>
									<component
										:is="iconComponent(element)"
										v-if="iconComponent(element)"
										class="size-4 shrink-0 stroke-1.5 text-ink-gray-7"
									/>
									<span
										v-else
										:class="[
											iconClass(element),
											'size-4 shrink-0 text-ink-gray-7',
										]"
									/>
									<span
										class="min-w-0 flex-1 truncate text-p-sm text-ink-gray-8"
									>
										{{ rowLabel(element) }}
									</span>
								</div>
								<div
									class="h-9 truncate border-e border-outline-gray-2 px-2 py-2 text-p-sm text-ink-gray-7"
								>
									{{ sidebarTypeLabel(element.item_type) }}
								</div>
								<div
									class="h-9 truncate border-e border-outline-gray-2 px-2 py-2 text-p-sm text-ink-gray-6"
									:title="targetLabel(element)"
								>
									{{ targetLabel(element) }}
								</div>
								<div
									class="flex h-9 items-center border-e border-outline-gray-2 px-2"
								>
									<Checkbox
										:data-testid="`visible-${element._clientId}`"
										:disabled="isLocked(element)"
										:aria-label="visibleLabel(element)"
										:modelValue="!element.hidden"
										@update:modelValue="
											(value: unknown) => toggleVisible(element, value)
										"
									/>
								</div>
								<div class="flex h-9 items-center justify-center px-1">
									<Dropdown
										v-if="hasRowMenu(element)"
										:options="rowMenuOptions(element)"
										align="end"
									>
										<Button
											:data-testid="`row-menu-${element._clientId}`"
											variant="ghost"
											:aria-label="menuLabel(element)"
										>
											<template #icon>
												<span class="lucide-ellipsis size-4 text-ink-gray-7" />
											</template>
										</Button>
									</Dropdown>
								</div>
							</div>
						</div>
					</template>
				</Draggable>
			</div>
		</div>

		<SidebarPageModal
			v-model="modalOpen"
			:page="editingPage"
			@saved="reloadFromServer"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import {
	Button,
	Checkbox,
	Dropdown,
	call,
	createDocumentResource,
	toast,
} from 'frappe-ui'
import Draggable from 'vuedraggable'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import SidebarPageModal from '@/components/Settings/Sidebar/SidebarPageModal.vue'
import * as icons from 'lucide-vue-next'
import {
	builtInIcon,
	LOCKED_VISIBLE,
	newClientId,
	rowLabel,
	sidebarTypeLabel,
	type SidebarRowDraft,
} from '@/components/Settings/Sidebar/sidebar'
import { useSettings } from '@/stores/settings'
import { cleanError } from '@/utils'
import type { LMSSidebarItem } from '@/types/lms/LMSSidebarItem'

defineProps<{ label: string }>()

const { loadSidebarSettings } = useSettings()

// Same cache key Settings.vue uses, so this is the document the dialog already
// loaded rather than a second copy of it.
const settings = createDocumentResource({
	doctype: 'LMS Settings',
	name: 'LMS Settings',
	fields: ['*'],
	cache: 'LMS Settings',
	auto: true,
})

// A working copy: drag reorders an array, and reordering the resource's own
// child table in place would fight the render. Every edit is written straight
// back; there is no Save button, so a toggle or a drag persists at once.
const rows = ref<SidebarRowDraft[]>([])
const modalOpen = ref(false)
const editingPage = ref<LMSSidebarItem | null>(null)

// An existing row keeps its own `name` as its client id, stable and already
// unique. A row with no `name` yet (freshly added, not yet saved) gets one
// here so two such rows in the same session never collide.
const withClientIds = (items: LMSSidebarItem[]): SidebarRowDraft[] =>
	items.map((item) => ({
		...item,
		_clientId: item.name ?? newClientId(),
	}))

const syncFromDoc = () => {
	rows.value = withClientIds(
		structuredClone(toRaw(settings.doc?.sidebar_items ?? []))
	)
}

watch(
	() => settings.doc?.sidebar_items,
	(items) => {
		if (items && !rows.value.length) syncFromDoc()
	},
	{ immediate: true }
)

// `_clientId` is this component's own bookkeeping. LMS Sidebar Item has no
// such field, and the saved document never carries one. Stripped before it
// reaches the payload.
const withoutClientId = (list: SidebarRowDraft[]): LMSSidebarItem[] =>
	list.map(({ _clientId, ...rest }) => rest)

// Item / Type / Target / Visible / menu, each `minmax(0, …fr)` so it shrinks
// and lets `truncate` do the rest; a fixed width here adds a horizontal
// scrollbar. Handle and menu columns sit outside the grid to keep their size.
const gridTemplateColumns =
	'minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 0.7fr) minmax(0, 0.5fr)'

const menuLabel = (row: SidebarRowDraft): string =>
	__('Actions for {0}').format(rowName(row))

// Only a web page can be edited: the modal re-icons a page, and that is all
// there is to change. Every custom row can be deleted.
const rowMenuOptions = (row: SidebarRowDraft) => {
	const options = []
	if (row.item_type === 'Web Page')
		options.push({
			label: __('Edit'),
			icon: 'lucide-pencil',
			onClick: () => openModal(row),
		})
	options.push({
		label: __('Delete'),
		icon: 'lucide-trash-2',
		onClick: () => remove(row),
	})
	return options
}

const hasRowMenu = (row: SidebarRowDraft): boolean => !row.is_standard

const targetLabel = (row: SidebarRowDraft): string =>
	row.web_page || row.route || row.url || ''

const isLocked = (row: SidebarRowDraft): boolean =>
	LOCKED_VISIBLE.has(row.name1 ?? '')

// Icons are stored by name; the picker offers all of lucide. Resolved the way
// the sidebar and picker already do, since a Tailwind class built from that
// name only exists when it's literal in source, true of built-ins, not user picks.
const iconComponent = (row: SidebarRowDraft) => {
	const name =
		row.icon || (row.item_type === 'Built-in' && builtInIcon(row.name1 ?? ''))
	return name ? (icons as Record<string, unknown>)[pascal(name)] ?? null : null
}

const pascal = (icon: string): string =>
	icon.replace(/(^|[-_ ])([a-z])/g, (_match, _sep, char) => char.toUpperCase())

// Kept for a stored name that resolves to no component.
const iconClass = (row: SidebarRowDraft): string => {
	const icon =
		row.icon || (row.item_type === 'Built-in' && builtInIcon(row.name1 ?? ''))
	return icon ? `lucide-${kebab(icon)}` : 'lucide-link'
}

const kebab = (icon: string): string =>
	icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

const rowName = (row: SidebarRowDraft): string => rowLabel(row) || __('link')

const dragHandleLabel = (row: SidebarRowDraft): string =>
	__('Reorder {0}').format(rowName(row))

const visibleLabel = (row: SidebarRowDraft): string =>
	__('Visible: {0}').format(rowName(row))

// The built-ins are a fixed block. A custom row reorders among the other
// custom rows; it can never be dropped up into that block, and a built-in has
// no handle to be dragged with at all.
const lastStandardIndex = computed(() => {
	let last = -1
	rows.value.forEach((row, index) => {
		if (row.is_standard) last = index
	})
	return last
})

const canMoveTo = (index: number): boolean => index > lastStandardIndex.value

const onMove = (event: { draggedContext: { futureIndex: number } }): boolean =>
	canMoveTo(event.draggedContext.futureIndex)

const openModal = (row: SidebarRowDraft | null) => {
	editingPage.value = row ? { ...toRaw(row) } : null
	modalOpen.value = true
}

const remove = (row: SidebarRowDraft) => {
	rows.value = rows.value.filter((entry) => entry !== row)
	persist()
}

const toggleVisible = (row: SidebarRowDraft, value: unknown) => {
	row.hidden = value ? 0 : 1
	persist()
}

// Handle elements, keyed by row, so an arrow-key move can put focus back on
// the same handle after the DOM re-renders in its new position.
const handleRefs = new Map<string, Element>()

const setHandleRef = (id: string | undefined, el: Element | null) => {
	if (!id) return
	if (el) handleRefs.set(id, el)
	else handleRefs.delete(id)
}

const moveRow = async (row: SidebarRowDraft, delta: number) => {
	if (row.is_standard) return
	const index = rows.value.findIndex(
		(entry) => entry._clientId === row._clientId
	)
	const target = index + delta
	if (index === -1 || target < 0 || target >= rows.value.length) return
	if (!canMoveTo(target)) return
	const reordered = [...rows.value]
	const [moved] = reordered.splice(index, 1)
	reordered.splice(target, 0, moved)
	rows.value = reordered
	await nextTick()
	;(handleRefs.get(row._clientId ?? '') as HTMLElement | undefined)?.focus()
	persist()
}

// Every list edit writes straight back, through its own endpoint rather than
// settings.save. One cached 'LMS Settings' document is shared by every panel,
// so saving from here would commit whatever another panel left dirty on it.
//
// call() carries no request sequence, so a rapid second edit can start a
// second persist() before the first resolves. Each call takes a token, and a
// superseded response is dropped instead of overwriting the table with a
// now-stale snapshot.
let requestToken = 0

const persist = async () => {
	const token = ++requestToken
	try {
		await call('lms.lms.api.save_sidebar_items', {
			rows: withoutClientId(rows.value),
		})
		if (token !== requestToken) return
		// The cached document is behind after a server-side write.
		await settings.reload()
		if (token !== requestToken) return
		syncFromDoc()
		await loadSidebarSettings(true)
	} catch (error: any) {
		if (token !== requestToken) return
		syncFromDoc()
		toast.error(cleanError(error?.messages?.[0]) || __('Error saving sidebar'))
	}
}

// The modal writes through its own endpoint and saves the parent server-side,
// so the cached document is behind; refetch it and rebuild the table.
const reloadFromServer = async () => {
	await settings.reload()
	syncFromDoc()
	await loadSidebarSettings(true)
}
</script>

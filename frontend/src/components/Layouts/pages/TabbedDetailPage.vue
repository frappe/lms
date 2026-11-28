<template>
	<div
		class="flex flex-col"
		:class="flowsWithPage ? 'min-h-full shrink-0' : 'h-full'"
	>
		<PageHeader
			:breadcrumbs="breadcrumbs"
			:published="published"
			:loading="loading"
		>
			<template v-if="$slots.status" #status>
				<slot name="status" />
			</template>
			<template #actions>
				<slot name="actions" :tab="activeTab" :instance="activeInstance" />
			</template>
		</PageHeader>
		<h1 v-if="ownsHeading" class="sr-only">{{ pageTitle }}</h1>

		<div v-if="!visibleTabs.length" class="min-h-0 flex-1">
			<slot name="solo" />
		</div>
		<div
			v-else
			ref="tabsBox"
			class="tab-row relative flex flex-1 flex-col"
			:class="{ 'min-h-0': !flowsWithPage, 'icon-tabs': iconTabs }"
			:style="{ '--tab-row-end-w': `${pinnedWidth}px` }"
		>
			<!-- Page actions that sit at the end of the tab row and stick with it,
			     over the strip's line, so tabs scrolled under them don't show around them. -->
			<div class="tab-row-pinned z-20 h-0">
				<div
					ref="pinned"
					class="pointer-events-none absolute end-0 top-0 flex h-[calc(var(--tab-row-h)-1px)] items-center gap-1 bg-surface-base px-5 [&>*]:pointer-events-auto"
				>
					<slot name="tab-row-end" :tab="activeTab" />
				</div>
			</div>
			<Tabs
				v-model="activeKey"
				:tabs="shorthandTabs"
				class="detail-tabs"
				:class="{ 'page-flow': flowsWithPage }"
			>
				<!-- The icon belongs in the prefix region, not the label: `#tab-label`
				     lands inside the trigger's `truncate` span, which clips a
				     `display: block` icon mask onto its own line. -->
				<template v-if="!isMobile || iconTabs" #tab-prefix="{ tab }">
					<span class="size-4" :class="own(tab.data).icon" />
				</template>
				<template #tab-label="{ tab }">
					<span :class="iconTabs ? 'sr-only' : 'text-p-base'">{{
						tabLabel(own(tab.data))
					}}</span>
				</template>
				<template #tab-panel="{ tab }">
					<template v-if="!loading">
						<slot
							v-if="$slots[bodySlot(own(tab.data))]"
							:name="bodySlot(own(tab.data))"
							:tab="own(tab.data)"
							:doc="doc"
						/>
						<component
							v-else
							:is="own(tab.data).component"
							:ref="(el: unknown) => setInstance(own(tab.data).key, el)"
							v-bind="bodyProps(own(tab.data))"
						/>
					</template>
					<slot v-else name="loading" :tab="own(tab.data)" />
				</template>
			</Tabs>

			<slot name="overlay" :tab="activeTab" />
		</div>
	</div>
</template>

<script lang="ts">
import type { Component } from 'vue'

export interface DetailTab {
	key: string
	label: string
	shortLabel?: string
	icon: string
	component: Component
	when?: boolean
	flow?: boolean
	rendersHeading?: boolean
	props?: Record<string, unknown>
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowReactive, watch } from 'vue'
import { Tabs } from 'frappe-ui'
import type { TabItem, TabValue } from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import { useStickyStackHeight } from '@/composables/useStickyStackHeight'
import { useElementSize } from '@vueuse/core'
import { useScreenSize } from '@/utils/composables'
import { useRoute, useRouter } from 'vue-router'
import type { Breadcrumb } from '@/types'

const props = withDefaults(
	defineProps<{
		tabs: DetailTab[]
		breadcrumbs: Breadcrumb[]
		doc: unknown
		docProp: string
		published?: boolean
		loading?: boolean
	}>(),
	{ published: false, loading: false }
)

defineSlots<{
	actions?: (props: { tab?: DetailTab; instance: unknown }) => any
	status?: () => any
	solo?: () => any
	/** Stands in for a tab's body while `loading`. */
	loading?: (props: { tab: DetailTab }) => any
	overlay?: (props: { tab?: DetailTab }) => any
	'tab-row-end'?: (props: { tab?: DetailTab }) => any
	[body: `tab-body-${string}`]: (props: { tab: DetailTab; doc: unknown }) => any
}>()

const route = useRoute()
const router = useRouter()
const { isMobile } = useScreenSize()

const instances = shallowReactive<Record<string, unknown>>({})

const tabsBox = ref<HTMLElement | null>(null)
const pinned = ref<HTMLElement | null>(null)
// The tab strip scrolls under nothing: it stops short of the pinned actions.
const { width: pinnedWidth } = useElementSize(pinned, undefined, {
	box: 'border-box',
})
useStickyStackHeight(
	computed(
		() => tabsBox.value?.querySelector<HTMLElement>('[role="tablist"]') ?? null
	),
	'--detail-tabs-h'
)

const visibleTabs = computed<DetailTab[]>(() =>
	props.tabs.filter((tab) => tab.when ?? true)
)

// Trigger value is the tab's own key, not a position: extra DetailTab fields
// (component, icon, flow, ...) ride along under `data`, which the shorthand
// slots read back as `tab.data`. `DetailTab` has no index signature, so it
// needs the same `unknown` step back into it that `own()` takes.
const shorthandTabs = computed<TabItem[]>(() =>
	visibleTabs.value.map((tab) => ({
		value: tab.key,
		data: tab as unknown as Record<string, unknown>,
	}))
)

const activeKey = ref<TabValue | undefined>(visibleTabs.value[0]?.key)

const activeTab = computed<DetailTab | undefined>(() =>
	visibleTabs.value.find((tab) => tab.key === activeKey.value)
)

const activeInstance = computed<unknown>(() =>
	activeTab.value ? instances[activeTab.value.key] ?? null : null
)

// A flow tab or the solo overview grows the page so the layout's scroller
// scrolls it; a bounded h-full box would end the sticky header's run one
// viewport down.
const flowsWithPage = computed<boolean>(
	() => !visibleTabs.value.length || Boolean(activeTab.value?.flow)
)

const pageTitle = computed<string>(
	() => props.breadcrumbs[props.breadcrumbs.length - 1]?.label ?? ''
)

// The solo slot and a `rendersHeading` tab carry a visible <h1> of their own.
const ownsHeading = computed<boolean>(
	() =>
		!props.loading &&
		Boolean(pageTitle.value) &&
		visibleTabs.value.length > 0 &&
		!activeTab.value?.rendersHeading
)

const own = (data: unknown): DetailTab => data as DetailTab

const bodySlot = (tab: DetailTab): `tab-body-${string}` => `tab-body-${tab.key}`

// On phones, tabs that all have an icon show only the icon.
const iconTabs = computed(
	() => isMobile.value && visibleTabs.value.every((tab) => tab.icon)
)

function tabLabel(tab: DetailTab): string {
	return isMobile.value && tab.shortLabel ? tab.shortLabel : tab.label
}

function bodyProps(tab: DetailTab): Record<string, unknown> {
	return { [props.docProp]: props.doc, ...tab.props }
}

function setInstance(key: string, el: unknown): void {
	instances[key] = el
}

function keyFromHash(): string {
	return route.hash.replace('#', '')
}

function selectFromHash(): void {
	const key = keyFromHash()
	if (!key) return
	const match = visibleTabs.value.find((tab) => tab.key === key)
	if (match) activeKey.value = match.key
}

onMounted(selectFromHash)

// A strip too wide for the screen scrolls; keep the picked tab in it.
watch(activeKey, async () => {
	await nextTick()
	tabsBox.value
		?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
		?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
})

watch(activeKey, () => {
	const tab = activeTab.value
	if (tab && tab.key !== keyFromHash()) {
		router.push({ ...route, hash: `#${tab.key}` })
	}
})

watch(() => route.hash, selectFromHash)

// A stale key (the visible set shrank under it) is Tabs' own job now — it
// falls back to the first selectable trigger and emits. Only the hash
// preference is this page's own: a tab hidden when the page opened can
// still be the one a deep link named, once it appears.
watch(visibleTabs, selectFromHash)

defineExpose({
	instanceFor: (key: string): unknown => instances[key] ?? null,
	flowsWithPage,
})
</script>

<style scoped>
/* Same box as the `.header-frame` above: one height token, one inset.
   frappe-ui sizes only the pills. It sticks right under the page header. */
.tab-row {
	--tab-row-h: var(--header-frame-h);
}

:deep([role='tablist']),
.tab-row-pinned {
	position: sticky;
	top: calc(var(--student-view-bar-h) + var(--header-frame-h));
}

:deep([role='tablist']) {
	z-index: 10;
	flex-shrink: 0;
	height: var(--tab-row-h);
	padding-inline: 1.25rem max(1.25rem, var(--tab-row-end-w, 0px));
	background-color: var(--surface-base);
	/* Too many tabs for the width scroll inside the strip, never the page. */
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
}

:deep([role='tab']) {
	flex-shrink: 0;
}

/* frappe-ui draws inactive tabs in ink-gray-5, under AA's 4.5:1. */
:deep([role='tab'] [data-state='inactive']:not(:hover)) {
	color: var(--ink-gray-6);
}

.detail-tabs {
	flex: 1 1 0%;
	min-height: 0;
}

:deep([role='tabpanel'][data-state='active']) {
	display: flex;
	flex: 1 1 0%;
	flex-direction: column;
	min-height: 0;
}

.detail-tabs.page-flow {
	min-height: auto;
	overflow: visible;
}

.detail-tabs.page-flow :deep([role='tabpanel'][data-state='active']) {
	display: block;
	flex: none;
	min-height: auto;
	overflow: visible;
}

@media (max-width: 639px) {
	.detail-tabs :deep([role='tablist']) {
		gap: 1rem;
	}
}

/* Icon-only tabs share the row equally, each a 44px-tall tap target. */
.tab-row.icon-tabs {
	--tab-row-h: calc(2.75rem + 1px);
}

.icon-tabs .detail-tabs :deep([role='tablist']) {
	gap: 0;
}

.icon-tabs :deep([role='tab']) {
	flex: 1 1 0%;
	min-width: 1.5rem;
	align-self: stretch;
}

.icon-tabs :deep([role='tab'] > [data-state]) {
	width: 100%;
	height: 100%;
}
</style>

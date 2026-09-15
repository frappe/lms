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
			<template #actions>
				<slot name="actions" :tab="activeTab" :instance="activeInstance" />
			</template>
		</PageHeader>

		<div v-if="!visibleTabs.length" class="min-h-0 flex-1">
			<slot name="solo" />
		</div>
		<div
			v-else
			class="relative flex flex-1 flex-col"
			:class="{ 'min-h-0': !flowsWithPage }"
		>
			<Tabs
				v-model="activeKey"
				:tabs="shorthandTabs"
				class="detail-tabs"
				:class="{ 'page-flow': flowsWithPage }"
			>
				<!-- The icon belongs in the prefix region, not the label: `#tab-label`
				     lands inside the trigger's `truncate` span, which clips a
				     `display: block` icon mask onto its own line. -->
				<template v-if="!isMobile" #tab-prefix="{ tab }">
					<span class="size-4" :class="own(tab.data).icon" />
				</template>
				<template #tab-label="{ tab }">
					{{ tabLabel(own(tab.data)) }}
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
	props?: Record<string, unknown>
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, shallowReactive, watch } from 'vue'
import { Tabs } from 'frappe-ui'
import type { TabItem, TabValue } from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
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
	solo?: () => any
	overlay?: (props: { tab?: DetailTab }) => any
	[body: `tab-body-${string}`]: (props: { tab: DetailTab; doc: unknown }) => any
}>()

const route = useRoute()
const router = useRouter()
const { isMobile } = useScreenSize()

const instances = shallowReactive<Record<string, unknown>>({})

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

const flowsWithPage = computed<boolean>(
	() => isMobile.value && Boolean(activeTab.value?.flow)
)

const own = (data: unknown): DetailTab => data as DetailTab

const bodySlot = (tab: DetailTab): `tab-body-${string}` => `tab-body-${tab.key}`

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

defineExpose({ instanceFor: (key: string): unknown => instances[key] ?? null })
</script>

<style scoped>
:deep([role='tablist']) {
	flex-shrink: 0;
}

:deep([role='tabpanel'][data-state='active']) {
	flex: 1 1 0%;
	min-height: 0;
}

.detail-tabs.page-flow {
	overflow: visible;
}

.detail-tabs.page-flow :deep([role='tabpanel'][data-state='active']) {
	flex: none;
	min-height: auto;
	overflow: visible;
}

@media (max-width: 639px) {
	.detail-tabs :deep([role='tablist']) {
		gap: 1rem;
		/* Same inset as the header above and the body below, so the whole page
		   lines up on one edge. */
		padding-inline: 1.25rem;
	}
}
</style>

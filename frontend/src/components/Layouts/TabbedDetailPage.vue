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
				v-model="tabIndex"
				:tabs="visibleTabs"
				class="detail-tabs"
				:class="{ 'page-flow': flowsWithPage }"
			>
				<template #tab-item="{ tab }">
					<button
						class="flex items-center gap-1.5 whitespace-nowrap py-2.5 text-p-base text-ink-gray-5 duration-300 ease-in-out hover:text-ink-gray-9 data-[state=active]:text-ink-gray-9"
					>
						<span v-if="!isMobile" class="size-4" :class="own(tab).icon" />
						{{ tabLabel(own(tab)) }}
					</button>
				</template>
				<template #tab-panel="{ tab }">
					<template v-if="!loading">
						<slot
							v-if="$slots[bodySlot(own(tab))]"
							:name="bodySlot(own(tab))"
							:tab="own(tab)"
							:doc="doc"
						/>
						<component
							v-else
							:is="own(tab).component"
							:ref="(el: unknown) => setInstance(own(tab).key, el)"
							v-bind="bodyProps(own(tab))"
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
import PageHeader from '@/components/Layouts/PageHeader.vue'
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

const tabIndex = ref<number>(0)
const instances = shallowReactive<Record<string, unknown>>({})

const visibleTabs = computed<DetailTab[]>(() =>
	props.tabs.filter((tab) => tab.when ?? true)
)

const activeTab = computed<DetailTab | undefined>(
	() => visibleTabs.value[tabIndex.value]
)

const activeInstance = computed<unknown>(() =>
	activeTab.value ? instances[activeTab.value.key] ?? null : null
)

const flowsWithPage = computed<boolean>(
	() => isMobile.value && Boolean(activeTab.value?.flow)
)

const own = (tab: unknown): DetailTab => tab as DetailTab

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
	const index = visibleTabs.value.findIndex((tab) => tab.key === key)
	if (index !== -1) tabIndex.value = index
}

onMounted(selectFromHash)

watch(tabIndex, () => {
	const tab = activeTab.value
	if (tab && tab.key !== keyFromHash()) {
		router.push({ ...route, hash: `#${tab.key}` })
	}
})

watch(() => route.hash, selectFromHash)

watch(visibleTabs, () => {
	if (tabIndex.value >= visibleTabs.value.length) tabIndex.value = 0
	selectFromHash()
})

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

<template>
	<!-- With Flow docked the side column closes and the nav fades on Flow's
	     own slide timing, so the two panels trade places in one motion. The
	     closed column's padding and slide are clipped rather than overflowing. -->
	<div
		class="grid w-full items-start gap-y-10 overflow-x-clip px-5 py-8 @4xl:transition-[grid-template-columns,column-gap] @4xl:duration-200 @4xl:ease-flow"
		:class="
			flowDocked
				? '@4xl:grid-cols-[minmax(0,1fr)_0rem] gap-x-0'
				: '@4xl:grid-cols-[minmax(0,1fr)_17.5rem] gap-x-6'
		"
	>
		<div class="min-w-0 space-y-10">
			<slot />
		</div>
		<!-- Runs the full height so its rule divides the fields from the nav;
		     the nav inside stays in view. -->
		<aside
			class="-my-8 hidden self-stretch overflow-x-clip border-s border-outline-gray-2 py-8 ps-6 transition-[opacity,transform] duration-200 ease-flow @4xl:block"
			:class="flowDocked ? 'pointer-events-none translate-x-4 opacity-0' : ''"
			:inert="flowDocked || undefined"
			data-testid="settings-sections"
		>
			<SettingsSectionNav
				class="sticky top-[calc(var(--sticky-stack-h)+1.25rem)] w-64"
				:sections="sections"
				:active="active"
				@select="goTo"
			/>
		</aside>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, provide, ref, shallowRef } from 'vue'
import SettingsSectionNav from '@/components/InlineEdit/SettingsSectionNav.vue'
import { useFlowDocked } from '@/composables/useFlowDocked'
import {
	SETTINGS_SECTIONS,
	inPageOrder,
	type SettingsSection,
} from '@/components/InlineEdit/settingsSections'

/** A settings tab: its sections in one column, a nav of them beside it from lg. */
// With Flow docked beside the app, one more panel is too many.
const flowDocked = useFlowDocked()
const props = defineProps<{
	/** The `name` of a section to open the page on, as a link asked. */
	openSection?: string | null
}>()
const sections = shallowRef<SettingsSection[]>([])
const active = ref<string | null>(null)
const inView = new Set<string>()
// The section a nav click scrolls to stays marked until that scroll ends,
// even when the page bottoms out before it reaches the top band.
let picked: string | null = null

// A section counts as in view while it crosses the band below the header.
// Absent outside a browser, where the nav simply marks the section picked.
const observer =
	'IntersectionObserver' in window
		? new IntersectionObserver(onIntersect, {
				rootMargin: '-80px 0px -60% 0px',
		  })
		: null

function onIntersect(entries: IntersectionObserverEntry[]): void {
	for (const entry of entries) {
		if (entry.isIntersecting) inView.add(entry.target.id)
		else inView.delete(entry.target.id)
	}
	if (picked) return
	const first = sections.value.find((section) => inView.has(section.id))
	if (first) active.value = first.id
}

function goTo(section: SettingsSection): void {
	active.value = picked = section.id
	const scroller = scrollParent(section.element)
	const target = scroller ?? window
	target.addEventListener('scrollend', () => (picked = null), { once: true })
	// The first section goes to the very top, tabs and all, as on arrival.
	if (section.id === sections.value[0]?.id) {
		scroller?.scrollTo({ top: 0, behavior: 'smooth' })
		return
	}
	section.element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollParent(element: HTMLElement): HTMLElement | null {
	let node = element.parentElement
	while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
		node = node.parentElement
	}
	return node
}

provide(SETTINGS_SECTIONS, {
	register(section) {
		sections.value = inPageOrder([...sections.value, section])
		active.value ??= sections.value[0].id
		observer?.observe(section.element)
		if (section.name && section.name === props.openSection) {
			nextTick(() => goTo(section))
		}
	},
	unregister(id) {
		const section = sections.value.find((current) => current.id === id)
		if (section) observer?.unobserve(section.element)
		sections.value = sections.value.filter((current) => current.id !== id)
		inView.delete(id)
	},
})

onBeforeUnmount(() => observer?.disconnect())
</script>

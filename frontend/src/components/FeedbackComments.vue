<template>
	<ul
		ref="list"
		class="flex min-h-0 list-none flex-col overflow-y-clip border-t border-outline-gray-1 pt-1"
		:aria-label="label"
	>
		<li v-for="(row, index) in rows" :key="row.name" class="-mx-2">
			<button
				type="button"
				class="flex w-full flex-col rounded-4 text-start transition-all duration-300 ease-in-out hover:bg-surface-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				@click="emit('select', row.name)"
			>
				<span class="flex w-full gap-2.5 px-2 py-2">
					<Avatar
						class="shrink-0"
						:image="row.member_image ?? undefined"
						:label="row.member_name"
						size="sm"
					/>
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="truncate text-sm text-ink-gray-6">
							{{ row.member_name }} · {{ timeAgo(row.creation) }}
						</span>
						<span
							v-if="row.feedback"
							class="line-clamp-2 text-p-sm text-ink-gray-8"
						>
							{{ row.feedback }}
						</span>
					</span>
				</span>
				<span
					v-if="index < rows.length - 1"
					class="mx-2 h-px border-t border-outline-gray-1 [li:has(+li.invisible)_&]:invisible"
					aria-hidden="true"
				/>
			</button>
		</li>
	</ul>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Avatar } from 'frappe-ui'
import { timeAgo } from '@/utils/format'
import type { FeedbackRow } from '@/types'

const props = defineProps<{ rows: FeedbackRow[]; label: string }>()

const emit = defineEmits<{ select: [name: string] }>()

const list = ref<HTMLUListElement | null>(null)

// On a short screen, drop whole comments, last first, so the ratings above
// never clip and the freed space goes to the panels below.
const fit = (): void => {
	const ul = list.value
	if (!ul) return
	const rows = Array.from(ul.children) as HTMLElement[]
	ul.style.maxHeight = ''
	for (const row of rows) {
		row.removeAttribute('inert')
		row.classList.remove('invisible')
	}
	const top = ul.getBoundingClientRect().top
	// Measured from the list's top, not the card's height: a squeezed card
	// has already given up more than the list's share.
	const card = ul.closest<HTMLElement>('[data-slot="chart-card"]')
	const plot = ul.closest<HTMLElement>('[data-slot="chart-plot"]')
	if (card && plot) {
		const box = card.getBoundingClientRect()
		const below = box.bottom - plot.getBoundingClientRect().bottom
		card.style.minHeight = `${Math.ceil(top - box.top + below)}px`
	}
	let used = 0
	let hidden = false
	for (const row of rows) {
		const { bottom } = row.getBoundingClientRect()
		hidden ||= bottom > top + ul.clientTop + ul.clientHeight + 1
		if (!hidden) used = bottom - top
		row.toggleAttribute('inert', hidden)
		row.classList.toggle('invisible', hidden)
	}
	ul.style.maxHeight = `${used}px`
}

let observer: ResizeObserver | null = null

// The card's column, not the list: once capped, the list stops resizing,
// but the column still tracks the window.
onMounted(() => {
	const ul = list.value
	if (typeof ResizeObserver === 'undefined' || !ul) return
	observer = new ResizeObserver(fit)
	observer.observe(ul.closest('[data-slot="chart-card"]')?.parentElement ?? ul)
})

onBeforeUnmount(() => observer?.disconnect())

watch(
	() => props.rows,
	() => nextTick(fit),
	{ flush: 'post' }
)
</script>

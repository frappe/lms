<template>
	<div class="@container flex flex-col gap-2">
		<FormControl
			v-model="query"
			type="text"
			:placeholder="__('Search icons')"
			:aria-label="__('Search icons')"
			@keydown.down.prevent="focusGrid"
		>
			<template #prefix>
				<span class="lucide-search size-4 text-ink-gray-5" />
			</template>
		</FormControl>
		<div ref="scroller" class="h-56 overflow-y-auto">
			<div
				ref="grid"
				class="grid justify-between gap-2"
				:class="
					large
						? 'grid-cols-[repeat(auto-fill,2.75rem)]'
						: 'grid-cols-[repeat(auto-fill,2.25rem)]'
				"
				role="group"
				:aria-label="__('Thumbnail icon')"
				@keydown="moveFocus"
			>
				<button
					v-for="name in visible"
					:key="name"
					type="button"
					class="flex items-center justify-center rounded-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					:class="[
						large ? 'size-11' : 'size-9',
						isPicked(name)
							? tint
								? courseTint(tint)
								: 'bg-surface-gray-3 text-ink-gray-9'
							: 'text-ink-gray-7 hover:bg-surface-gray-2 hover:text-ink-gray-9',
					]"
					:tabindex="name === focusable ? 0 : -1"
					:aria-label="name.replace(/-/g, ' ')"
					:aria-pressed="isPicked(name)"
					@click="icon = name"
				>
					<span
						:class="[courseIcon(name), large ? 'size-5' : 'size-4']"
						aria-hidden="true"
					/>
				</button>
			</div>
			<p
				v-if="!visible.length"
				class="py-6 text-center text-p-sm text-ink-gray-6"
			>
				{{ __('No icons match') }}
			</p>
			<div ref="sentinel" class="h-px" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { FormControl } from 'frappe-ui'
import { useIntersectionObserver } from '@vueuse/core'
import { COURSE_ICONS, courseIcon } from '@/utils/courseIcons'
import { courseTint } from '@/utils/courseTints'
import { loadIconTags } from '@/utils/lucideIconStyles'

/**
 * Any lucide icon for a course thumbnail: curated first, searchable by name or
 * keyword. Square cells of one size, as many as fit a row.
 */

defineProps<{
	/** Bigger cells and icons, for a roomy page rather than a popover. */
	large?: boolean
	/** The picked icon takes this course colour. */
	tint?: string | null
}>()

const icon = defineModel<string | null | undefined>()

const PAGE = 108
const query = ref('')
const limit = ref(PAGE)
const tags = shallowRef<Record<string, string[]>>({})
const scroller = ref<HTMLElement>()
const grid = ref<HTMLElement>()
const sentinel = ref<HTMLElement>()

// Read once, so picking an icon never reorders the grid under the pointer.
const opening = courseIcon(icon.value).replace(/^lucide-/, '')

const first = COURSE_ICONS.includes(opening)
	? COURSE_ICONS
	: [opening, ...COURSE_ICONS]

const ordered = computed(() => [
	...first,
	...Object.keys(tags.value).filter((name) => !first.includes(name)),
])

/** Every typed word starts a word of the icon's name or keywords. */
function matches(name: string, terms: string[]): boolean {
	const words = [name, ...(tags.value[name] || [])]
		.join(' ')
		.toLowerCase()
		.split(/[\s-]+/)
	return terms.every((term) => words.some((word) => word.startsWith(term)))
}

const results = computed(() => {
	const terms = query.value
		.toLowerCase()
		.split(/[\s-]+/)
		.filter(Boolean)
	if (!terms.length) return ordered.value
	return ordered.value.filter((name) => matches(name, terms))
})

const visible = computed(() => results.value.slice(0, limit.value))

const current = computed(() => courseIcon(icon.value))
const isPicked = (name: string): boolean => current.value === `lucide-${name}`

const focusable = computed(
	() => visible.value.find(isPicked) || visible.value[0]
)

onMounted(async () => {
	tags.value = await loadIconTags()
})

watch(query, () => {
	limit.value = PAGE
	scroller.value?.scrollTo?.({ top: 0 })
})

useIntersectionObserver(
	sentinel,
	([entry]) => {
		if (entry?.isIntersecting && limit.value < results.value.length)
			limit.value += PAGE
	},
	{ root: scroller }
)

function focusGrid(): void {
	grid.value?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
}

/** Columns as laid out, which the container may have cut below `columns`. */
function renderedColumns(): number {
	const template = grid.value
		? getComputedStyle(grid.value).gridTemplateColumns
		: ''
	const count = template.split(' ').filter(Boolean).length
	return Math.max(count, 1)
}

function nextIndex(key: string, from: number, count: number): number | null {
	const columns = renderedColumns()
	const steps: Record<string, number> = {
		ArrowLeft: -1,
		ArrowRight: 1,
		ArrowUp: -columns,
		ArrowDown: columns,
	}
	if (key === 'Home') return 0
	if (key === 'End') return count - 1
	if (!(key in steps)) return null
	return Math.min(Math.max(from + steps[key], 0), count - 1)
}

function moveFocus(event: KeyboardEvent): void {
	const buttons = [...(grid.value?.querySelectorAll('button') || [])]
	const from = buttons.indexOf(event.target as HTMLButtonElement)
	const to = nextIndex(event.key, from, buttons.length)
	if (from < 0 || to === null) return
	event.preventDefault()
	buttons[to].focus()
}
</script>

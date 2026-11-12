<template>
	<Teleport to="body">
		<div
			v-if="card"
			role="tooltip"
			class="pointer-events-none fixed z-50 w-80 max-w-[calc(100vw-2rem)] rounded-7 border border-outline-gray-2 bg-surface-base p-3 shadow-lg"
			:style="{ top: `${card.top}px`, left: `${card.left}px` }"
		>
			<div class="mb-1 flex items-center gap-1.5 text-p-xs text-ink-gray-6">
				<span class="lucide-file-text size-3.5" aria-hidden="true" />
				{{ card.label }}
			</div>
			<p class="text-p-sm text-ink-gray-8">
				{{ card.text || __('Loading the passage…') }}
			</p>
			<p class="mt-2 text-p-xs text-ink-gray-6">
				{{ __('Click to open the document at this page.') }}
			</p>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { call } from 'frappe-ui'

// Shows the cited passage when someone hovers or focuses a citation link inside `container`.
const props = defineProps<{ container: HTMLElement | null }>()

const card = ref<{
	label: string
	text: string | null
	top: number
	left: number
} | null>(null)
const cache = new Map<string, string | null>()
let timer: ReturnType<typeof setTimeout> | null = null
let current: HTMLAnchorElement | null = null

const citationOf = (target: EventTarget | null): HTMLAnchorElement | null => {
	const link = (target as HTMLElement | null)?.closest?.('a')
	return link && link.href.includes('lms.lms.ai.api.source_file')
		? (link as HTMLAnchorElement)
		: null
}

const show = (link: HTMLAnchorElement) => {
	const url = new URL(link.href)
	const page = new URLSearchParams(url.hash.slice(1)).get('page')
	const params: Record<string, string> = Object.fromEntries(url.searchParams)
	if (page) params.page = page
	params.near = (link.parentElement?.textContent || '').slice(0, 400)
	const key = `${params.document}|${page}|${params.near}`
	const box = link.getBoundingClientRect()
	const left = Math.min(Math.max(16, box.left), window.innerWidth - 336)
	const below = box.bottom + 8
	card.value = {
		label: link.textContent || '',
		text: cache.get(key) ?? null,
		top: below + 180 > window.innerHeight ? Math.max(16, box.top - 188) : below,
		left,
	}
	if (cache.has(key)) return
	call('lms.lms.ai.api.source_excerpt', params)
		.then((text: string | null) => {
			cache.set(
				key,
				text ||
					__('This passage could not be loaded. Click to open the document.')
			)
			if (current === link && card.value)
				card.value.text = cache.get(key) || null
		})
		.catch(() => null)
}

const onOver = (event: Event) => {
	const link = citationOf(event.target)
	if (!link || link === current) return
	current = link
	if (timer) clearTimeout(timer)
	timer = setTimeout(() => show(link), 250)
}

const onOut = (event: Event) => {
	const link = citationOf(event.target)
	if (
		!link ||
		link.contains((event as MouseEvent).relatedTarget as Node | null)
	)
		return
	if (timer) clearTimeout(timer)
	current = null
	card.value = null
}

const events: [string, (event: Event) => void][] = [
	['mouseover', onOver],
	['mouseout', onOut],
	['focusin', onOver],
	['focusout', onOut],
]

watch(
	() => props.container,
	(element, previous) => {
		for (const [name, handler] of events)
			previous?.removeEventListener(name, handler)
		for (const [name, handler] of events)
			element?.addEventListener(name, handler)
	},
	{ immediate: true }
)

onBeforeUnmount(() => {
	for (const [name, handler] of events)
		props.container?.removeEventListener(name, handler)
	if (timer) clearTimeout(timer)
})
</script>

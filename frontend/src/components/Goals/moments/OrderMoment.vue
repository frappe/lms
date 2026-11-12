<template>
	<div>
		<p class="mb-3 text-p-sm text-ink-gray-7">{{ moment.prompt }}</p>
		<Draggable
			v-model="items"
			item-key="text"
			:disabled="!!result"
			handle=".order-handle"
			class="space-y-1.5"
		>
			<template #item="{ element, index }">
				<div
					class="flex items-center gap-2 rounded-5 border px-2.5 py-2 text-p-sm"
					:class="itemClass(element, index)"
				>
					<span
						v-if="!result"
						class="order-handle lucide-grip-vertical size-4 shrink-0 cursor-grab text-ink-gray-6"
					/>
					<span
						v-else
						class="size-4 shrink-0"
						:class="
							element.position === index
								? 'lucide-circle-check text-ink-green-6'
								: 'lucide-circle-x text-ink-amber-6'
						"
					/>
					<span class="flex-1 text-ink-gray-8">{{ element.text }}</span>
					<template v-if="!result">
						<Button
							variant="ghost"
							size="sm"
							:aria-label="__('Move up')"
							:disabled="index === 0"
							@click="move(index, -1)"
						>
							<template #icon
								><span class="lucide-arrow-up size-3.5"
							/></template>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							:aria-label="__('Move down')"
							:disabled="index === items.length - 1"
							@click="move(index, 1)"
						>
							<template #icon
								><span class="lucide-arrow-down size-3.5"
							/></template>
						</Button>
					</template>
					<span
						v-else-if="element.position !== index"
						class="text-p-xs text-ink-gray-6"
					>
						{{ __('belongs at step {0}').format(element.position + 1) }}
					</span>
				</div>
			</template>
		</Draggable>
		<div v-if="!result" class="mt-3 flex items-center justify-between">
			<span class="text-p-xs text-ink-gray-6">{{
				__('Drag, or use the arrows.')
			}}</span>
			<Button variant="solid" size="sm" @click="check">{{
				__('Check order')
			}}</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'frappe-ui'
import Draggable from 'vuedraggable'

interface Item {
	text: string
	position: number
}

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
}>()
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

const steps: string[] = props.moment.steps || []
const start = (): Item[] => {
	if (props.result?.order)
		return props.result.order.map((text: string) => ({
			text,
			position: steps.indexOf(text),
		}))
	const shuffled = steps.map((text, position) => ({ text, position }))
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}
	if (shuffled.every((item, i) => item.position === i) && shuffled.length > 1)
		shuffled.reverse()
	return shuffled
}
const items = ref<Item[]>(start())

const move = (index: number, step: number) => {
	const list = [...items.value]
	const [item] = list.splice(index, 1)
	list.splice(index + step, 0, item)
	items.value = list
}

const check = () => {
	const misplaced = items.value
		.filter((item, i) => item.position !== i)
		.map((item) => item.text)
	emit('answer', {
		correct: !misplaced.length,
		order: items.value.map((item) => item.text),
		summary: { their_order: items.value.map((item) => item.text), misplaced },
	})
}

const itemClass = (item: Item, index: number) => {
	if (!props.result) return 'border-outline-gray-2 bg-surface-base'
	return item.position === index
		? 'border-outline-green-2 bg-surface-green-1'
		: 'border-outline-amber-2 bg-surface-amber-1'
}
</script>

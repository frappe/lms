<template>
	<div>
		<p class="mb-3 text-p-base text-ink-gray-9">{{ moment.prompt }}</p>
		<div
			v-if="moment.message"
			class="flex gap-3 rounded-5 bg-surface-gray-1 px-3 py-2.5"
		>
			<CharacterAvatar
				v-if="cast"
				:who="cast"
				:label="speaker"
				class="size-7 shrink-0"
			/>
			<div class="min-w-0">
				<p v-if="speaker" class="text-p-xs font-medium text-ink-gray-6">
					{{ speaker }}
				</p>
				<p class="text-p-sm text-ink-gray-9">{{ moment.message }}</p>
			</div>
		</div>
		<template v-if="!result">
			<FormControl
				v-model="text"
				type="textarea"
				class="mt-3"
				:rows="3"
				:placeholder="__('Say it the way you would say it')"
				:aria-label="moment.prompt"
			/>
			<div class="mt-3 flex items-center justify-between gap-3">
				<span class="text-p-xs text-ink-gray-6">{{
					__('A few sentences, in your own words')
				}}</span>
				<Button
					variant="solid"
					size="sm"
					:disabled="words < 3"
					:label="__('Send')"
					@click="send"
				/>
			</div>
		</template>
		<div v-else class="mt-3">
			<p class="text-p-xs font-medium text-ink-gray-6">{{ __('You said') }}</p>
			<p class="mt-0.5 whitespace-pre-line text-p-sm text-ink-gray-9">
				{{ result.their_words }}
			</p>
			<p class="mt-3 text-p-xs font-medium text-ink-gray-6">
				{{ __('A good answer') }}
			</p>
			<ul class="mt-0.5 space-y-0.5">
				<li
					v-for="criterion in criteria"
					:key="criterion"
					class="flex items-start gap-2 text-p-sm text-ink-gray-7"
				>
					<span class="mt-1 size-3.5 shrink-0 lucide-check text-ink-gray-5" />
					{{ criterion }}
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { CAST_NAMES, isCastKey } from '@/utils/characters'

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
}>()
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

const criteria: string[] = props.moment.criteria || []
const cast = isCastKey(props.moment.cast) ? props.moment.cast : null
const speaker = cast ? CAST_NAMES[cast] : ''

const text = ref('')
const words = computed(
	() => text.value.trim().split(/\s+/).filter(Boolean).length
)

// There is no answer key: the tutor reads their words against the criteria and
// reacts in the next turn, so the result carries no verdict of its own.
const send = () => {
	if (props.result || words.value < 3) return
	const their_words = text.value.trim()
	emit('answer', {
		correct: null,
		their_words,
		summary: { criteria },
	})
}
</script>

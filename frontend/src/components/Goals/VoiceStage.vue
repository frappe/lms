<template>
	<!-- The stage shares the input strip's column, so the character, the exercise and
	     the mic line up as one thing. -->
	<div
		class="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col gap-4 px-4 sm:px-6"
	>
		<!-- Without an exercise the character is the whole stage. With one, they sit above
		     it as a row: face, name and the sentence being spoken, like a speaker at a desk. -->
		<div
			class="flex items-center gap-4"
			:class="
				moment
					? 'shrink-0 flex-row pb-2 pt-8'
					: 'flex-1 flex-col justify-center gap-3 py-6 text-center'
			"
		>
			<CharacterAvatar
				:who="character"
				:mood="running ? 'think' : speaking ? 'happy' : 'calm'"
				:label="assistantName"
				class="shrink-0 transition-transform"
				:class="[
					moment ? 'size-12 sm:size-14' : 'size-24 sm:size-28',
					speaking ? 'scale-105' : '',
				]"
			/>
			<div class="min-w-0" :class="moment ? 'flex-1 text-start' : ''">
				<div
					class="text-ink-gray-9"
					:class="moment ? 'text-p-sm font-medium' : 'text-base-medium'"
				>
					{{ assistantName }}
				</div>
				<!-- The sentence being spoken, not a transcript: the voice is the medium here. -->
				<p
					class="text-ink-gray-8"
					:class="
						moment
							? 'mt-0.5 min-h-12 text-p-base'
							: 'mx-auto mt-1 min-h-28 max-w-md text-lg'
					"
					aria-live="polite"
				>
					{{ caption || (running ? thinkingLabel : '') }}
				</p>
			</div>
		</div>
		<!-- The exercise takes the rest of the height. Its layouts are compact enough to fit;
		     scrolling is only the fallback on a short screen, so it never slides under the
		     strip below. -->
		<div v-if="moment" class="min-h-0 flex-1 overflow-y-auto pb-3">
			<MomentBlock
				:id="moment.id"
				:moment="moment.moment"
				:result="result"
				@answer="emit('answer', $event)"
			/>
		</div>
		<div v-if="$slots.after" class="shrink-0 pb-3">
			<slot name="after" />
		</div>
	</div>
</template>

<script setup lang="ts">
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import MomentBlock from '@/components/Goals/moments/MomentBlock.vue'
import type { CharacterKey } from '@/utils/characters'
import type { Moment } from '@/composables/useFlowChat'

// Speak mode's stage: the character with live captions, and the activity at hand
// under them instead of inside a transcript.
defineProps<{
	character: CharacterKey
	assistantName: string
	caption: string
	speaking: boolean
	running: boolean
	thinkingLabel: string
	moment: Moment | null
	result?: Record<string, any>
}>()

const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>()
</script>

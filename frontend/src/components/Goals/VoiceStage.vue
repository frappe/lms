<template>
	<div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
		<!-- While an exercise is up it is the workspace and gets the room; the
		     character folds into a slim presence column beside it. -->
		<!-- On a phone, an exercise turns the character into a small row above it. -->
		<div
			class="flex items-center justify-center gap-3 px-4"
			:class="
				moment
					? 'shrink-0 flex-row py-2 md:w-52 md:flex-col md:py-4'
					: 'flex-1 flex-col py-6'
			"
		>
			<CharacterAvatar
				:who="character"
				:mood="running ? 'think' : speaking ? 'happy' : 'calm'"
				:label="assistantName"
				class="transition-transform"
				:class="[
					moment ? 'size-10 shrink-0 md:size-20' : 'size-24 sm:size-28',
					speaking ? 'scale-105' : '',
				]"
			/>
			<div
				class="text-base-medium text-ink-gray-9"
				:class="moment ? 'hidden md:block' : ''"
			>
				{{ assistantName }}
			</div>
			<!-- The sentence being spoken, not a transcript: the voice is the medium here. -->
			<p
				class="max-w-md text-ink-gray-8"
				:class="
					moment
						? 'min-h-0 text-start text-p-sm md:min-h-16 md:text-center md:text-p-base'
						: 'min-h-16 text-center text-lg'
				"
				aria-live="polite"
			>
				{{ caption || (running ? thinkingLabel : '') }}
			</p>
		</div>
		<!-- The exercise takes the rest of the width. Its layouts are compact enough to fit;
		     scrolling is only the fallback on a short screen, so it never slides under the
		     strip below. -->
		<div
			v-if="moment"
			class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-1"
		>
			<div class="my-auto w-full max-w-3xl py-3">
				<MomentBlock
					:id="moment.id"
					:moment="moment.moment"
					:result="result"
					@answer="emit('answer', $event)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import MomentBlock from '@/components/Goals/moments/MomentBlock.vue'
import type { CharacterKey } from '@/utils/characters'
import type { Moment } from '@/composables/useFlowChat'

// Speak mode's stage: the character front and center with live captions, and the
// activity at hand beside them instead of inside a transcript.
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

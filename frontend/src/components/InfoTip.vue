<template>
	<TooltipProvider :delay-duration="500">
		<TooltipRoot v-model:open="open" disable-closing-trigger>
			<TooltipTrigger as-child>
				<button
					type="button"
					class="inline-grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9"
					:aria-label="label"
					:aria-describedby="hintId"
					@pointerdown="pointerType = $event.pointerType"
					@click="onClick"
				>
					<span class="lucide-info size-4" aria-hidden="true" />
				</button>
			</TooltipTrigger>
			<TooltipPortal :to="portalTarget">
				<TooltipContent
					side="top"
					:side-offset="4"
					:collision-padding="8"
					class="z-[100] max-w-[calc(100vw-1rem)]"
				>
					<div
						class="rounded-4 bg-surface-gray-10 px-2 py-1 text-xs text-ink-base shadow-xl"
						data-testid="info-tip-bubble"
						aria-hidden="true"
					>
						{{ text }}
					</div>
					<TooltipArrow class="fill-surface-gray-10" :width="8" :height="4" />
				</TooltipContent>
			</TooltipPortal>
		</TooltipRoot>
	</TooltipProvider>
	<span :id="hintId" class="sr-only">{{ text }}</span>
</template>
<script setup lang="ts">
import { usePortalTarget } from 'frappe-ui'
import {
	TooltipArrow,
	TooltipContent,
	TooltipPortal,
	TooltipProvider,
	TooltipRoot,
	TooltipTrigger,
} from 'reka-ui'
import { ref, useId } from 'vue'

/**
 * An (i) button with a hint: a tooltip on hover and keyboard focus, which a
 * click or tap also toggles, since a tooltip alone ignores touch.
 */
defineProps<{ label: string; text: string }>()

const open = ref<boolean>(false)
// Touch gets no hover, so a tap toggles; a mouse or keyboard press only opens,
// since hover or focus has usually opened it already.
const pointerType = ref<string>('')
const hintId = useId()
const portalTarget = usePortalTarget()

function onClick(): void {
	open.value = ['touch', 'pen'].includes(pointerType.value) ? !open.value : true
	pointerType.value = ''
}
</script>

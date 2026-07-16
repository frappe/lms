<template>
	<div class="relative flex w-full max-w-[23rem] flex-col gap-3 sm:gap-0">
		<!-- Back chevron floats just left of the card -->
		<Button
			v-if="current > 0"
			variant="ghost"
			class="self-start sm:absolute sm:right-full sm:top-12 sm:mr-4"
			:aria-label="backLabel"
			@click="back"
		>
			<template #icon>
				<LucideChevronLeft class="size-4" />
			</template>
		</Button>

		<div class="flex flex-col gap-5">
			<LMSLogo class="size-7" />

			<Transition name="persona-step" mode="out-in" @after-enter="focusStep">
				<div
					:key="step.key"
					tabindex="-1"
					class="flex flex-col gap-5 focus:outline-none"
				>
					<div class="flex flex-col gap-1">
						<h2 class="text-p-2xl-bold text-ink-gray-9">
							{{ step.title }}
						</h2>
						<p v-if="step.subtitle" class="text-p-base text-ink-gray-6">
							{{ step.subtitle }}
						</p>
					</div>

					<component
						:is="bodyComponent"
						:step="step"
						:value="answers[step.key]"
						@select="onSelect"
						@deselect="onDeselect"
						@input="onInput"
						@choose="onChoose"
					/>

					<Button
						v-if="step.type !== 'outcome'"
						variant="solid"
						size="md"
						class="w-full"
						:disabled="!isAnswered"
						@click="next"
					>
						{{ nextLabel }}
					</Button>
				</div>
			</Transition>
		</div>
	</div>
</template>

<script setup>
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import PersonaTagStep from '@/components/Persona/PersonaTagStep.vue'
import PersonaTextStep from '@/components/Persona/PersonaTextStep.vue'
import PersonaOutcomeStep from '@/components/Persona/PersonaOutcomeStep.vue'
import { Button } from 'frappe-ui'
import { computed, reactive, ref } from 'vue'

const props = defineProps({
	steps: {
		type: Array,
		required: true,
	},
})

const emit = defineEmits(['complete', 'choose'])

const BODY = {
	tags: PersonaTagStep,
	text: PersonaTextStep,
	outcome: PersonaOutcomeStep,
}

const current = ref(0)
const answers = reactive({})

const step = computed(() => props.steps[current.value])
const bodyComponent = computed(() => BODY[step.value.type] ?? PersonaTagStep)
const isAnswered = computed(() => {
	const value = answers[step.value.key]
	if (step.value.type === 'text') return Boolean(value && value.trim())
	return value !== undefined
})

const nextLabel = computed(() => __('Next'))
const backLabel = computed(() => __('Back'))

function advance() {
	if (current.value < props.steps.length - 1) {
		current.value += 1
		// Reaching the outcome step means the questions are done — hand the
		// answers up. Re-emitted on every arrival so edits made after going
		// Back are never submitted stale.
		if (step.value.type === 'outcome') {
			emit('complete', { ...answers })
		}
	}
}

function onSelect(option) {
	answers[step.value.key] = option.value
	advance()
}

function onDeselect() {
	delete answers[step.value.key]
}

// Text steps report their value as it's typed; Next advances when non-empty.
function onInput(value) {
	answers[step.value.key] = value
}

function onChoose(option) {
	emit('choose', step.value, option)
}

function next() {
	if (isAnswered.value) advance()
}

function back() {
	if (current.value > 0) current.value -= 1
}

function focusStep(el) {
	el.focus()
}
</script>

<style scoped>
.persona-step-enter-active,
.persona-step-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}
/* The leaving step is still in the DOM for 150ms; ignore clicks on it so a
   fast double-click can't write the old option into the next step's key. */
.persona-step-leave-active {
	pointer-events: none;
}
.persona-step-enter-from {
	opacity: 0;
	transform: translateY(6px);
}
.persona-step-leave-to {
	opacity: 0;
	transform: translateY(-6px);
}
</style>

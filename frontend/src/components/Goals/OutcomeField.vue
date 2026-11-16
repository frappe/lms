<template>
	<section>
		<FormControl
			type="textarea"
			variant="outline"
			class="[&_textarea]:resize-none"
			:rows="rows"
			:label="__('What should people be able to do?')"
			:placeholder="
				__(
					'For example: calm an upset customer, spot a fire hazard, or close the books at month end'
				)
			"
			:modelValue="modelValue"
			@update:modelValue="(value: string) => emit('update:modelValue', value)"
			@blur="emit('save')"
		/>

		<p v-if="!hasMaterial" class="mt-2 text-p-xs text-ink-gray-6">
			{{ __('Add your material above to get suggestions from it.') }}
		</p>

		<!-- Suggestions open in a panel from the link, so the sidebar keeps its height. -->
		<div v-else class="mt-3 text-p-xs text-ink-gray-6">
			{{ __('Need a starting point?') }}
			<Popover v-model:open="open" side="bottom" align="start" :offset="6">
				<template #trigger>
					<button
						type="button"
						class="font-medium text-ink-gray-8 underline decoration-[var(--outline-gray-3)] underline-offset-2 hover:text-ink-gray-9 hover:decoration-[var(--ink-gray-4)] disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="reading"
						@click="suggestOnce"
					>
						{{ __('Suggest from my material') }}
					</button>
				</template>
				<div class="w-[22rem] max-w-[calc(100vw-2rem)] p-1">
					<!-- The wait looks like what arrives: three suggestions, each a short angle and two lines. -->
					<div v-if="suggesting" class="flex flex-col gap-1" :aria-busy="true">
						<div
							class="flex items-center gap-2 px-2.5 pb-1 pt-1.5 text-p-xs text-ink-gray-6"
						>
							<LoadingIndicator class="size-3.5" />
							{{ __('Reading your material. About twenty seconds.') }}
						</div>
						<div
							v-for="n in 3"
							:key="n"
							class="flex flex-col gap-2 px-2.5 py-2"
						>
							<div
								class="h-2.5 w-1/3 animate-pulse rounded bg-surface-gray-2"
							/>
							<div class="h-3 w-full animate-pulse rounded bg-surface-gray-1" />
							<div class="h-3 w-4/5 animate-pulse rounded bg-surface-gray-1" />
						</div>
					</div>
					<ul v-else-if="options.length" class="flex flex-col">
						<li v-for="option in options" :key="option.label">
							<button
								type="button"
								class="block w-full rounded-5 px-2.5 py-2 text-start hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2 focus-visible:outline-none"
								@click="pick(option)"
							>
								<span class="block text-p-xs text-ink-gray-6">
									{{ option.label }}
								</span>
								<span class="mt-0.5 line-clamp-2 text-p-sm text-ink-gray-8">
									{{ option.outcome }}
								</span>
							</button>
						</li>
					</ul>
					<ErrorMessage
						v-else-if="error"
						class="px-2.5 py-2"
						:message="error"
					/>
					<p v-else class="px-2.5 py-2 text-p-sm text-ink-gray-6">
						{{
							__(
								'Nothing to suggest from this material yet. Add more and try again.'
							)
						}}
					</p>
					<div
						v-if="!suggesting"
						class="mt-1 flex justify-end border-t border-outline-gray-1 pt-1"
					>
						<Button
							size="sm"
							variant="ghost"
							:disabled="reading"
							@click="suggest"
						>
							{{ __('Refresh') }}
						</Button>
					</div>
				</div>
			</Popover>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
	Button,
	call,
	ErrorMessage,
	FormControl,
	LoadingIndicator,
	Popover,
} from 'frappe-ui'

interface Option {
	label: string
	outcome: string
}

const props = defineProps<{
	goal: string
	modelValue: string
	hasMaterial: boolean
	reading: boolean
}>()
const emit = defineEmits<{
	'update:modelValue': [value: string]
	save: []
}>()

// Grows with the text, about 45 characters a line in this column, so nothing is cut off.
const rows = computed(() =>
	Math.min(10, Math.max(3, Math.ceil((props.modelValue || '').length / 45) + 1))
)

const options = ref<Option[]>([])
const suggesting = ref(false)
const open = ref(false)
const error = ref<string | null>(null)
let poll: ReturnType<typeof setInterval> | null = null

const stop = () => {
	if (poll) clearInterval(poll)
	poll = null
}

const suggest = async () => {
	stop()
	error.value = null
	options.value = []
	suggesting.value = true
	try {
		const session = await call('lms.lms.ai.api.suggest_outcome', {
			goal: props.goal,
		})
		poll = setInterval(async () => {
			const result = await call('lms.lms.ai.api.outcome_state', {
				session,
			}).catch(() => null)
			if (!result || result.running) return
			stop()
			suggesting.value = false
			options.value = result.options || []
			error.value = result.error
		}, 2500)
	} catch (err) {
		suggesting.value = false
		error.value = (err as Error).message
	}
}

// The first open asks; later opens show the same three until Refresh.
const suggestOnce = () => {
	// A failure stays on screen until Refresh; it is not retried on every open.
	if (!options.value.length && !error.value && !suggesting.value) suggest()
}

// The chosen option goes into the box and is saved, so the admin edits it like their own words.
const pick = (option: Option) => {
	emit('update:modelValue', option.outcome)
	emit('save')
	open.value = false
	options.value = []
}

onBeforeUnmount(stop)
</script>

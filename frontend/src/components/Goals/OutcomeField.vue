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

		<template v-else>
			<p v-if="!options.length" class="mt-3 text-p-xs text-ink-gray-6">
				{{ __('Need a starting point?') }}
				<span v-if="suggesting" class="text-ink-gray-7">
					{{ __('Suggesting from your material…') }}
				</span>
				<button
					v-else
					type="button"
					class="font-medium text-ink-gray-8 underline decoration-[var(--outline-gray-3)] underline-offset-2 hover:text-ink-gray-9 hover:decoration-[var(--ink-gray-4)] disabled:cursor-not-allowed disabled:opacity-50"
					:disabled="reading"
					@click="suggest"
				>
					{{ __('Suggest from my material') }}
				</button>
			</p>
			<div v-else class="mt-3 flex items-center gap-2">
				<span class="flex-1 text-p-xs text-ink-gray-6">
					{{ __('Suggestions from your material') }}
				</span>
				<Button
					size="sm"
					variant="ghost"
					:loading="suggesting"
					:disabled="reading"
					@click="suggest"
				>
					{{ __('Refresh') }}
				</Button>
			</div>

			<div
				v-if="suggesting && !options.length"
				class="mt-2 space-y-px overflow-hidden rounded-6 border border-outline-gray-2"
				:aria-busy="true"
			>
				<div
					v-for="n in 3"
					:key="n"
					class="h-16 animate-pulse bg-surface-gray-1"
				/>
			</div>

			<ul
				v-else-if="options.length"
				class="mt-2 divide-y divide-outline-gray-2 overflow-hidden rounded-6 border border-outline-gray-2"
			>
				<li v-for="option in options" :key="option.label">
					<button
						type="button"
						class="block w-full whitespace-normal break-words px-3 py-2.5 text-start hover:bg-surface-gray-1 focus-visible:bg-surface-gray-1 focus-visible:outline-none"
						@click="use(option)"
					>
						<span class="block text-p-xs text-ink-gray-6">
							{{ option.label }}
						</span>
						<span class="mt-0.5 block text-p-sm text-ink-gray-8">
							{{ option.outcome }}
						</span>
					</button>
				</li>
			</ul>
		</template>

		<ErrorMessage class="mt-2" :message="error" />
	</section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Button, call, ErrorMessage, FormControl } from 'frappe-ui'

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

// The chosen option goes into the box and is saved, so the admin edits it like their own words.
const use = (option: Option) => {
	emit('update:modelValue', option.outcome)
	emit('save')
	options.value = []
}

onBeforeUnmount(stop)
</script>

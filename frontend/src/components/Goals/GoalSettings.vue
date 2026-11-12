<template>
	<section :aria-label="__('Settings')">
		<div>
			<div class="border-b border-outline-gray-2 py-4">
				<SwitchRow
					v-model="goal.tutor_first"
					:label="__('Start with Lumi')"
					:description="
						__(
							'Lumi teaches only what each learner doesn\'t know yet. Turn it off to show the key ideas as cards.'
						)
					"
					@update:model-value="emit('change')"
				/>
			</div>

			<div class="border-b border-outline-gray-2 pt-4">
				<h3 class="text-p-base font-medium text-ink-gray-8">
					{{ __('What counts as passing') }}
				</h3>
				<p class="mt-1 text-p-sm text-ink-gray-6">
					{{
						__(
							'People pass when they finish every part and meet each rule you turn on. With no rules, finishing is enough.'
						)
					}}
				</p>
				<div
					class="mt-3 divide-y divide-outline-gray-2 border-t border-outline-gray-2"
				>
					<div class="py-4">
						<SwitchRow
							v-model="goal.proof_mastery"
							:label="__('Passing percentage')"
							:description="
								goal.tutor_first
									? __('Their average score across role-plays and the check.')
									: __(
											'Their average score across scenarios, role-plays and the check.'
									  )
							"
							@update:model-value="emit('change')"
						/>
						<div
							v-if="goal.proof_mastery"
							class="mt-3 flex items-center gap-2 text-p-sm text-ink-gray-7"
						>
							<span>{{ __('At least') }}</span>
							<FormControl
								v-model="goal.mastery_threshold"
								variant="outline"
								type="number"
								size="sm"
								class="w-16"
								:aria-label="__('Passing percentage')"
								@change="emit('change')"
							/>
							<span>{{ __('percent') }}</span>
						</div>
					</div>
					<div class="py-4">
						<SwitchRow
							v-model="goal.proof_acknowledgement"
							:label="__('Confirm they understood')"
							:description="
								__('They agree to a short statement, and we record when.')
							"
							@update:model-value="emit('change')"
						/>
						<FormControl
							v-if="goal.proof_acknowledgement"
							v-model="goal.acknowledgement_text"
							variant="outline"
							type="textarea"
							class="mt-3 [&_textarea]:resize-none"
							:aria-label="__('What they agree to')"
							:placeholder="
								__(
									'For example, I know how to leave the building safely when the alarm sounds.'
								)
							"
							@change="emit('change')"
						/>
					</div>
					<div class="py-4">
						<SwitchRow
							v-model="goal.proof_sign_off"
							:label="__('Sign-off in person')"
							:description="
								__(
									'Someone checks it with them, for example after a live demo or drill.'
								)
							"
							@update:model-value="emit('change')"
						/>
					</div>
					<div class="py-4">
						<SwitchRow
							v-model="goal.proof_certificate"
							:label="__('Certificate')"
							:description="__('Give them a certificate when they pass.')"
							@update:model-value="emit('change')"
						/>
					</div>
				</div>
			</div>

			<div class="py-4">
				<h3 class="text-p-base font-medium text-ink-gray-8">
					{{ __("Who it's for") }}
				</h3>
				<p class="mt-1 text-p-sm text-ink-gray-6">
					{{ __('Changes save as you make them.') }}
				</p>
				<div
					class="mt-3.5 grid grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-[7.5rem_1fr]"
				>
					<span class="text-p-base text-ink-gray-6">{{ __('Everyone') }}</span>
					<div class="flex items-center gap-3">
						<Switch
							v-model="goal.assign_everyone"
							:aria-label="__('Everyone')"
							@update:model-value="emit('change')"
						/>
						<span class="text-p-sm text-ink-gray-6">{{
							__('Everyone with an account here')
						}}</span>
					</div>
					<template v-if="!goal.assign_everyone">
						<span class="text-p-base text-ink-gray-6">{{ __('People') }}</span>
						<div class="w-full sm:w-44">
							<MultiLink
								v-model="audience"
								doctype="User"
								variant="outline"
								class="w-full"
								:placeholder="__('Add people')"
								@change="emit('change')"
							/>
						</div>
					</template>
					<label for="goal-due-date" class="text-p-base text-ink-gray-6">{{
						__('Due date')
					}}</label>
					<div class="w-full sm:w-44">
						<FormControl
							id="goal-due-date"
							v-model="goal.due_date"
							variant="outline"
							type="date"
							@change="emit('change')"
						/>
					</div>
					<span class="text-p-base text-ink-gray-6">{{ __('Repeats') }}</span>
					<div class="w-full sm:w-44">
						<FormControl
							v-model="goal.recurrence"
							variant="outline"
							type="select"
							:aria-label="__('Repeats')"
							:options="[
								{ label: __('Never'), value: 'Once' },
								{ label: __('Every year'), value: 'Yearly' },
							]"
							@change="emit('change')"
						/>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FormControl, Switch } from 'frappe-ui'
import SwitchRow from '@/components/Controls/SwitchRow.vue'
import MultiLink from '@/components/Controls/MultiLink.vue'

const props = defineProps<{ goal: Record<string, any> }>()
const emit = defineEmits<{ change: [] }>()

const audience = computed<string[]>({
	get: () =>
		(props.goal.audience || []).map((row: { user: string }) => row.user),
	set: (users) => {
		props.goal.audience = users.map((user) => ({ user }))
	},
})
</script>

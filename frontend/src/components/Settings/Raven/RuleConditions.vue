<template>
	<ConditionBuilder
		:model-value="rules.tree.value"
		@update:model-value="onTreeUpdate"
		:reorderable="false"
		bordered="all"
		:max-depth="MAX_CONDITION_DEPTH"
		:new-condition="rules.newCondition"
		:readonly="nothingToAdd"
	>
		<template #condition="{ condition, path, readonly, update }">
			<RuleCondition
				:rule="condition"
				:name-id="nameId(path)"
				:problem="rules.invalid.value.get(pathKey(path))"
				:problem-message-id="sectionErrorId"
				:readonly="readonly"
				@update="update"
			/>
		</template>

		<template #condition-actions="{ path, isGroup, readonly, remove }">
			<Dropdown
				v-if="!isGroup && !readonly"
				:options="menuFor(remove)"
				align="end"
				data-slot="condition-actions"
			>
				<Button variant="ghost" :aria-labelledby="actionsLabelledBy(path)">
					<template #icon>
						<span class="lucide-more-horizontal size-4" aria-hidden="true" />
					</template>
				</Button>
			</Dropdown>
		</template>

		<template #add-condition="{ canAddGroup, addCondition, addGroup }">
			<Dropdown
				v-slot="{ open }"
				:options="addOptions(canAddGroup, addCondition, addGroup)"
			>
				<Button
					:disabled="rules.noConditionTypes.value"
					:label="__('Add Condition')"
					icon-left="lucide-plus"
					:icon-right="open ? 'lucide-chevron-up' : 'lucide-chevron-down'"
				/>
			</Dropdown>
		</template>

		<template #empty>
			<span class="lucide-plus size-4" aria-hidden="true" />
			{{ __('Add a condition') }}
		</template>
	</ConditionBuilder>

	<span :id="actionsWordId" class="sr-only">{{ __('Condition actions') }}</span>

	<p
		v-if="mixed"
		data-testid="mixed-conjunctions-note"
		class="mt-2 text-p-sm text-ink-gray-6"
	>
		{{
			__(
				'These conditions were saved joining some rows with and and others with or. This screen shows one joiner per group, so it cannot draw that. They are written back as they are until you move a joiner or change the rows, either of which sets one joiner for the whole group.'
			)
		}}
	</p>

	<div
		v-if="sectionErrors.length"
		:id="sectionErrorId"
		class="mt-2"
		data-testid="section-errors"
	>
		<p
			v-for="message in sectionErrors"
			:key="message"
			class="text-p-sm text-ink-red-6"
		>
			{{ message }}
		</p>
	</div>
</template>

<script setup lang="ts">
// The condition tree of one channel, on the framework's ConditionBuilder. This
// file supplies the row (our rules are {provider, rule_type, config}, not
// field/operator/value), the per-row menu, and the names those two need.
//
// Reordering is off: a group is pure and or pure or, so row order never changes
// who matches, and the built-in drag is pointer-only.
//
// `#condition-actions` takes `aria-labelledby`, never `aria-label`: frappe-ui's
// Button overwrites aria-label from its own `label` prop.
import { ConditionBuilder } from '@framework/ui/ConditionBuilder'
import { Button, Dropdown } from 'frappe-ui'
import { computed, useId } from 'vue'
import RuleCondition from './RuleCondition.vue'
import type { ChannelRules } from '@/composables/raven/useChannelRules'
import { MAX_CONDITION_DEPTH } from '@/utils/raven/constants'
import {
	forgetMovedJoiners,
	hasMixedConjunctions,
	pathKey,
} from '@/utils/raven/ruleAdapter'
import type { RuleGroup, RulePath } from '@/types'

const props = defineProps<{ rules: ChannelRules }>()

// A group whose joiner has just moved forgets the joiners it was loaded with.
// Here rather than in a watcher: a watcher on the finished tree cannot tell a
// move from a move and back.
function onTreeUpdate(next: RuleGroup): void {
	forgetMovedJoiners(next)
	props.rules.tree.value = next
}

// One id per mount, not one per row: useId() inside slot content still runs in
// this component's setup, so every row would be handed the same value.
const uid = useId()
const actionsWordId = `${uid}-actions`
const sectionErrorId = `${uid}-error`

function nameId(path: RulePath): string {
	return `${uid}-cond-${pathKey(path).replace(/\./g, '-')}`
}

// The row's own name first, then the word "actions": eight identical "Condition
// actions" buttons cannot be told apart by voice control or a rotor listing.
function actionsLabelledBy(path: RulePath): string {
	return `${nameId(path)} ${actionsWordId}`
}

// Said rather than worked around: the single joiner on screen is not what the
// channel is stored as, and the reader has no other way to find that out.
const mixed = computed<boolean>(() =>
	hasMixedConjunctions(props.rules.tree.value)
)

const sectionErrors = computed<string[]>(() => {
	if (props.rules.declarationsUnavailable.value)
		return [
			__('Condition types could not be loaded. Reload the page to try again.'),
		]
	const kinds = new Set(
		Array.from(props.rules.invalid.value.values(), (problem) => problem.kind)
	)
	const messages: string[] = []
	// Two instructions, because the fixes differ: an incomplete condition can be
	// finished, an undeclared one has nothing to fill in and has to be replaced.
	if (kinds.has('undeclared'))
		messages.push(
			__(
				'A condition here was written for an older version and can no longer be applied. Remove it and add the condition you want.'
			)
		)
	if (kinds.has('incomplete'))
		messages.push(__('Finish every condition before saving.'))
	return messages
})

// `#empty` fills the component's own button rather than replacing it, so
// guarding `#add-condition` alone left "Add a condition" live with no
// declarations loaded. `readonly` is what turns that button into plain text, and
// an empty tree is the one state where freezing the rows costs nothing.
// `noConditionTypes`, not `declarationsUnavailable`: the latter waits for the
// request to settle, which left the window open for the whole fetch.
const nothingToAdd = computed<boolean>(
	() =>
		props.rules.noConditionTypes.value &&
		props.rules.tree.value.conditions.length === 0
)

// The component has no `disabled`, so blocking adds happens here. Without a
// declaration a new row could only name a type that does not exist. Rows stay
// editable: removing one is still worth doing when the list cannot be added to.
function addOptions(
	canAddGroup: boolean,
	addCondition: () => void,
	addGroup: () => void
) {
	const options = [{ label: __('Add Condition'), onClick: addCondition }]
	if (canAddGroup)
		options.push({ label: __('Add Condition Group'), onClick: addGroup })
	return options
}

// Remove alone: there is no longer a concept of turning a condition off.
function menuFor(remove: () => void) {
	return [
		{
			label: __('Remove'),
			icon: 'lucide-trash-2',
			theme: 'red' as const,
			// The component's own remove, never a write into the tree: only this
			// path moves focus to the next row and announces the count.
			onClick: remove,
		},
	]
}
</script>

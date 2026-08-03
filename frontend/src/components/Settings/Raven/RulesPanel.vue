<template>
	<section>
		<div class="mb-3">
			<div class="flex items-center gap-2">
				<h3 class="text-p-lg-semibold text-ink-gray-8">
					{{ title }}
				</h3>
				<Badge
					v-if="subtitle"
					theme="gray"
					variant="subtle"
					:label="subtitle"
				/>
			</div>
			<p v-if="description" class="mt-1 text-p-sm text-ink-gray-5">
				{{ description }}
			</p>
		</div>

		<!-- The backend skips a mapping with no Active rules ({skipped, reason:
			 'no_active_rules'}), so say so instead of leaving a silent no-op. -->
		<div
			v-if="!hasActiveRules && noActiveRulesMessage"
			class="mb-3 flex gap-2 rounded bg-surface-amber-1 p-3 text-p-sm text-ink-amber-6"
		>
			<AlertTriangle class="mt-0.5 size-4 shrink-0" />
			<span>{{ noActiveRulesMessage }}</span>
		</div>

		<!-- (c) Disabled rules drop out of an All (AND) intersection entirely, so the
			 population is wider than the visible rule list implies. Nothing else says
			 so — Disable is hidden under AND, but a mapping switched to AND after a
			 rule was disabled still lands here. -->
		<div
			v-if="combinator === 'All (AND)' && hasDisabledRules"
			class="mb-3 flex gap-2 rounded bg-surface-amber-1 p-3 text-p-sm text-ink-amber-6"
		>
			<AlertTriangle class="mt-0.5 size-4 shrink-0" />
			<span>
				{{
					__(
						'Disabled rules are left out of All (AND), so this matches more people than the rules below suggest. Enable or remove them to narrow it.'
					)
				}}
			</span>
		</div>

		<!-- Without the rule-type declaration nothing can be checked before it is sent,
			 so saving stops entirely rather than committing unvalidated rules. -->
		<div
			v-if="declarationUnavailable"
			class="mb-3 flex gap-2 rounded bg-surface-amber-1 p-3 text-p-sm text-ink-amber-6"
		>
			<AlertTriangle class="mt-0.5 size-4 shrink-0" />
			<span>
				{{
					__(
						'Rule types could not be loaded, so rule changes are not being saved. Reload the page to try again.'
					)
				}}
			</span>
		</div>

		<!-- A saved rule withheld from the payload would be hard-deleted by the
			 backend's full-list replace, so the whole save stops until it is fixed. -->
		<div
			v-if="hasInvalidSavedRule"
			class="mb-3 flex gap-2 rounded bg-surface-amber-1 p-3 text-p-sm text-ink-amber-6"
		>
			<AlertTriangle class="mt-0.5 size-4 shrink-0" />
			<span>
				{{
					__(
						'Changes are not being saved while a saved rule needs fixing. Resolve the rule below to resume saving.'
					)
				}}
			</span>
		</div>

		<div
			v-if="!draft.length"
			class="flex p-4 items-center justify-center gap-2 text-p-sm border border-outline-gray-2 text-ink-gray-5 rounded-md"
			:class="canAddRule ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'"
			@click="addRule()"
		>
			<Plus class="size-4 stroke-1.5" />
			{{ __('Add rule') }}
		</div>

		<div v-else class="flex flex-col gap-3 w-full">
			<div
				v-for="row in draft"
				:key="row.key"
				class="flex flex-col gap-2 rounded-lg border border-outline-gray-2 p-4"
				:class="isLocked(row) ? 'opacity-60' : ''"
				@focusout="commitRow(row.key)"
				@dblclick="onCardDoubleClick(row)"
			>
				<div class="flex items-center gap-2">
					<TextInput
						:disabled="isLocked(row)"
						:model-value="row.rule.label ?? ''"
						@update:model-value="
							onRowInput(row.key, {
								...row.rule,
								label: ($event as string) || undefined,
							})
						"
						:placeholder="__('Label — e.g. Cohort cap')"
						:aria-label="__('Label')"
						class="w-full"
					/>
					<!-- Another app owns this rule: badged so it is not mistaken for one of
						 ours, frozen because this UI does not know its vocabulary. -->
					<Badge
						v-if="isForeign(row)"
						theme="gray"
						variant="subtle"
						:label="managedByLabel(row)"
					/>
					<Dropdown v-else placement="right" :options="rowOptions(row.key)">
						<Button variant="ghost" :aria-label="__('Rule actions')">
							<template #icon>
								<MoreHorizontal class="size-4 stroke-1.5" />
							</template>
						</Button>
					</Dropdown>
				</div>

				<!-- A disabled rule is frozen, not half-editable: an edit that never
					 syncs reads as saved. Enable it from the "..." menu to change it. -->
				<RuleEditor
					:model-value="row.rule"
					:disabled="isLocked(row)"
					@update:model-value="(r) => onRowInput(row.key, r)"
				/>

				<p v-if="hintKey === row.key" class="text-p-sm text-ink-gray-5">
					{{ __('Enable it to edit') }}
				</p>

				<!-- The backend rejects unnamed, half-filled and duplicate rules; catching
					 it here keeps the card editable instead of round-tripping to an error. -->
				<p
					v-if="invalidKeys.has(row.key)"
					class="flex items-center gap-1 text-p-sm text-ink-amber-6"
				>
					<AlertTriangle class="size-3.5 shrink-0" />
					{{ invalidMessage(row.key) }}
				</p>
			</div>

			<div class="flex">
				<Button
					variant="outline"
					:disabled="!canAddRule"
					:title="canAddRule ? undefined : __('Finish the rule above first')"
					@click="addRule"
				>
					<template #prefix><Plus class="size-4 stroke-1.5" /></template>
					{{ __('Add rule') }}
				</Button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { Badge, Button, Dropdown, TextInput } from 'frappe-ui'
import {
	Plus,
	MoreHorizontal,
	Trash2,
	AlertTriangle,
	Ban,
	CircleCheck,
} from 'lucide-vue-next'
import { computed, h, onUnmounted, ref, watch } from 'vue'
import RuleEditor from './RuleEditor.vue'
import { LMS_PROVIDER, ruleIdentity } from '@/utils/raven/ruleAdapter'
import {
	defaultsOf,
	hasRequiredFields,
	isDeclaredRuleType,
	isForeignRule,
	useProviderDeclarations,
	useProviderRuleTypes,
} from '@/composables/raven/providerSchema'
import type { RavenMemberRule, RuleStatus } from '@/types'

interface DropdownOption {
	label: string
	icon: () => ReturnType<typeof h>
	theme?: 'red'
	onClick: () => void
}

// Timers and the `v-for` key on this stable client key, not the array index: deleting
// a rule mid-commit would otherwise write one rule's edits into another's slot.
interface DraftRow {
	key: string
	rule: RavenMemberRule
}

const props = defineProps<{
	title: string
	description?: string
	subtitle?: string
	rules: RavenMemberRule[]
	/** Mapping's rule combinator. Disable is Any (OR)-only — see rowOptions. */
	combinator?: string
	noActiveRulesMessage: string
}>()
// Emits the whole list, not an index-based mutation: index emits recomputed from the
// parent's stale array, so two edits in one debounce window clobbered each other.
const emit = defineEmits<{
	// `fromRemoval` tells the parent this change deleted a rule, so it confirms on
	// any member drop rather than only past the mass-removal threshold.
	persist: [rules: RavenMemberRule[], options?: { fromRemoval?: boolean }]
	// A saved row's status is written field-wise, off the full-list-replace path:
	// an unnamed saved rule blocks every save (D1) but must still be enableable.
	'set-status': [ruleName: string, status: RuleStatus]
}>()

type InvalidReason = 'unnamed' | 'incomplete' | 'duplicate' | 'undeclared'

// The LMS rule vocabulary, as this app declares it to raven_integration.
const declarations = useProviderDeclarations()
const ruleTypes = useProviderRuleTypes(() => LMS_PROVIDER)

// What a rule must contain to be savable is the declaration's to say. Without it
// every rule here is unvalidated, so none of them may be committed.
const hasDeclaration = computed<boolean>(() => ruleTypes.value.length > 0)

// Told apart from "still loading" so a slow fetch does not flash a failure notice.
const declarationUnavailable = computed<boolean>(
	() => !hasDeclaration.value && !declarations.loading
)

// Duplicate identity matches the backend's own check. Draft order puts persisted
// rules first (addRule only pushes), so this flags the second row, never the original.
const invalidKeys = computed<Map<string, InvalidReason>>(() => {
	const seen = new Set<string>()
	const invalid = new Map<string, InvalidReason>()
	for (const row of draft.value) {
		// A foreign rule is neither ours to judge nor ours to fix, and its provider
		// keeps it out of our uniqueness scope.
		if (isForeignRule(row.rule)) continue
		// Nothing is judged until the declaration lands; the section notice covers it.
		if (!hasDeclaration.value) continue
		if (!isDeclaredRuleType(ruleTypes.value, row.rule.rule_type))
			invalid.set(row.key, 'undeclared')
		else if (!row.rule.label?.trim()) invalid.set(row.key, 'unnamed')
		else if (!isRuleComplete(row.rule)) invalid.set(row.key, 'incomplete')
		else {
			const id = ruleIdentity(row.rule)
			if (seen.has(id)) invalid.set(row.key, 'duplicate')
			else seen.add(id)
		}
	}
	return invalid
})

// A row the server already stores: withholding it deletes it, so it blocks instead.
const hasInvalidSavedRule = computed<boolean>(() =>
	draft.value.some((row) => row.rule.name && invalidKeys.value.has(row.key))
)

// Nothing to add before the declaration lands — a rule with no type is unsavable.
const canAddRule = computed<boolean>(
	() => invalidKeys.value.size === 0 && hasDeclaration.value
)

function invalidMessage(key: string): string {
	const reason = invalidKeys.value.get(key)
	if (reason === 'undeclared')
		return __(
			'This rule type is no longer offered — pick another one to resume saving.'
		)
	if (reason === 'unnamed')
		return __('Name this rule — it is not saved until it has one.')
	if (reason === 'incomplete')
		return __('Finish this rule — pick what it should match to save it.')
	return __(
		'Matches another rule above — not saved. Change the type or criteria to keep it.'
	)
}

function emitDraft(options?: { fromRemoval?: boolean }): void {
	// No declaration, no validation: without it an empty field list passes every rule,
	// so an unfinished one would be committed as if it were checked.
	if (!hasDeclaration.value) return
	// `update_workspace` replaces the rule list wholesale, so a saved rule left out
	// of the payload is deleted. Block the save rather than lose it.
	if (hasInvalidSavedRule.value) return
	// Never-persisted invalid rows stay in the draft (still editable) but are never
	// sent, so "Add rule" leaves an unsaved card with a hint instead of a server error.
	const next = draft.value
		.filter((row) => !invalidKeys.value.has(row.key))
		.map((row) => row.rule)
	// Withholding a card means the payload can come out identical to what is already
	// saved. Emitting it anyway costs a no-op save whose reload rebuilds `draft` from
	// the server — deleting the card the user just added, with nothing logged. Adding
	// a second rule to a mapping whose only rule is the default did exactly that.
	if (JSON.stringify(next) === JSON.stringify(props.rules ?? [])) return
	emit('persist', next, options)
}

// Debounced per-row commit — avoids per-keystroke API spam.
// Declared above the draft because reconciliation reads the pending set.
const commitTimers = new Map<string, ReturnType<typeof setTimeout>>()
const COMMIT_DELAY_MS = 700

let keySeq = 0
function nextKey(): string {
	keySeq += 1
	return `new-${keySeq}`
}

// Deep-cloned from props so keystrokes never mutate parent state. Persisted rules key
// on their backend name, so a refetch mid-edit leaves timers on the same rules.
const draft = ref<DraftRow[]>([])

// Reconciled by key, never replaced wholesale: every save round-trips through a
// refetch, and rebuilding the array from the server list threw away the card the
// user had just added and whatever they were typing into another.
function reconcile(current: DraftRow[], rules: RavenMemberRule[]): DraftRow[] {
	const byKey = new Map(current.map((row) => [row.key, row]))
	// Unsaved draft rows a newly-named server rule has claimed as its own. A row
	// persisted for the first time comes back with a docname (now its key), which no
	// longer matches the `new-N` key it carried while unsaved — so byKey misses it.
	// Match it by identity and mark it consumed, or the trailing loop re-adds the
	// very row that was just saved as a phantom duplicate of itself.
	const consumed = new Set<string>()
	const next = rules.map((rule) => {
		const key = rule.name ?? nextKey()
		const row = byKey.get(key)
		// A row with a commit still pending holds the newer copy — the server's is the
		// state before that edit, so taking it would undo the keystrokes in flight.
		if (row && commitTimers.has(key)) return row
		if (!row && rule.name) {
			const justSaved = current.find(
				(r) =>
					!r.rule.name &&
					!consumed.has(r.key) &&
					ruleIdentity(r.rule) === ruleIdentity(rule)
			)
			if (justSaved) consumed.add(justSaved.key)
		}
		return {
			key,
			rule: JSON.parse(JSON.stringify(rule)) as RavenMemberRule,
		}
	})
	// A card the server has no counterpart for is unsaved work — a new rule, or one
	// withheld from the payload for being incomplete. A refetch is not a deletion.
	// A just-saved row (consumed) already appears above, so it is not unsaved work.
	const serverKeys = new Set(next.map((row) => row.key))
	for (const row of current) {
		if (!row.rule.name && !serverKeys.has(row.key) && !consumed.has(row.key))
			next.push(row)
	}
	return next
}

watch(
	() => props.rules,
	(rules) => {
		draft.value = reconcile(draft.value, rules ?? [])
	},
	{ immediate: true, deep: true }
)

const hasActiveRules = computed(() =>
	draft.value.some((row) => row.rule.status === 'Active')
)

const hasDisabledRules = computed(() =>
	draft.value.some((row) => row.rule.status === 'Paused')
)

function blankRule(): RavenMemberRule {
	const ruleType = ruleTypes.value[0]?.type ?? ''
	return {
		rule_type: ruleType,
		status: 'Active',
		...defaultsOf(ruleTypes.value, ruleType),
	}
}

// No emit: a blank rule is unnamed, so it is never immediately savable.
function addRule(): void {
	if (!canAddRule.value) return
	draft.value.push({ key: nextKey(), rule: blankRule() })
}

function removeRule(key: string): void {
	const index = draft.value.findIndex((row) => row.key === key)
	if (index < 0) return
	clearTimer(key)
	draft.value.splice(index, 1)
	// Any other row's pending edit is already in the draft, so it rides along
	// rather than being clobbered by, or clobbering, this removal.
	emitDraft({ fromRemoval: true })
}

// Disabling keeps the rule's config but stops it granting membership. Committed at
// once rather than debounced — it's a discrete action, not typing.
// Stored as `Paused` (the doctype's Select option); the UI calls it Disabled.
function toggleStatus(key: string): void {
	const row = draft.value.find((r) => r.key === key)
	if (!row) return
	clearTimer(key)
	const status: RuleStatus = row.rule.status === 'Paused' ? 'Active' : 'Paused'
	row.rule = { ...row.rule, status }
	if (hintKey.value === key) hintKey.value = null
	// A never-persisted row has no docname to address, so its status is just draft.
	if (row.rule.name) emit('set-status', row.rule.name, status)
	else emitDraft()
}

function isForeign(row: DraftRow): boolean {
	return isForeignRule(row.rule)
}

function managedByLabel(row: DraftRow): string {
	return `${__('Managed by')} ${row.rule.provider}`
}

// Frozen while disabled — the "..." menu (Enable / Remove) is the way out. A foreign
// rule is frozen for good: its own app is where it is edited.
function isLocked(row: DraftRow): boolean {
	return row.rule.status === 'Paused' || isForeign(row)
}

// One hint at a time, cleared when the rule is enabled — nothing to time out.
const hintKey = ref<string | null>(null)

// Only a disabled rule of ours has a way out to point at; the foreign badge says
// the rest.
function onCardDoubleClick(row: DraftRow): void {
	hintKey.value = isLocked(row) && !isForeign(row) ? row.key : null
}

function onRowInput(key: string, rule: RavenMemberRule): void {
	const row = draft.value.find((r) => r.key === key)
	if (!row) return
	row.rule = rule
	scheduleCommit(key)
}

// Which fields a rule must fill in is the provider's declaration (`reqd`), not a
// second copy of the rule vocabulary kept here.
function isRuleComplete(rule: RavenMemberRule): boolean {
	return hasRequiredFields(ruleTypes.value, rule)
}

function commitRow(key: string): void {
	clearTimer(key)
	// The row may have been removed since the edit was scheduled; the draft is
	// authoritative either way, so persist it as it now stands.
	if (!draft.value.some((row) => row.key === key)) return
	emitDraft()
}

function scheduleCommit(key: string): void {
	clearTimer(key)
	commitTimers.set(
		key,
		setTimeout(() => commitRow(key), COMMIT_DELAY_MS)
	)
}

function clearTimer(key: string): void {
	const timer = commitTimers.get(key)
	if (timer) clearTimeout(timer)
	commitTimers.delete(key)
}

onUnmounted(() => {
	for (const timer of commitTimers.values()) clearTimeout(timer)
	commitTimers.clear()
})

function rowOptions(key: string): DropdownOption[] {
	const off =
		draft.value.find((row) => row.key === key)?.rule.status === 'Paused'
	// Under All (AND) a rule narrows the population, so disabling one would *widen*
	// it — adding people, the opposite of what disabling means. Offer it on Any (OR)
	// only. An already-disabled rule keeps its Enable so an AND switch can't strand it.
	const canDisable = props.combinator !== 'All (AND)' || off
	return [
		...(canDisable
			? [
					{
						label: off ? __('Enable') : __('Disable'),
						icon: () => h(off ? CircleCheck : Ban),
						onClick: () => toggleStatus(key),
					},
			  ]
			: []),
		{
			label: __('Remove'),
			icon: () => h(Trash2),
			theme: 'red',
			onClick: () => removeRule(key),
		},
	]
}
</script>

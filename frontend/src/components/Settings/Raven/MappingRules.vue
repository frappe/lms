<template>
	<div>
		<RulesPanel
			:title="title"
			:description="description"
			:subtitle="subtitle"
			:rules="rules"
			:combinator="combinator"
			:no-active-rules-message="noActiveRulesMessage"
			@persist="onRulesPersist"
			@set-status="onSetStatus"
		/>

		<MassRemovalConfirmDialog
			v-model:open="massRemovalOpen"
			:removed-count="massRemoval?.removed ?? 0"
			:target-label="targetLabel"
			@confirm="onMassRemovalConfirm"
			@cancel="onMassRemovalCancel"
		/>
	</div>
</template>

<script setup lang="ts">
// Shared rules master-detail so WorkspaceList and ChannelsView don't each duplicate
// it. Endpoints, params and copy are picked by entity.
import { createResource, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import RulesPanel from './RulesPanel.vue'
import MassRemovalConfirmDialog from './MassRemovalConfirmDialog.vue'
import type {
	RavenMemberRule,
	WorkspaceDetail,
	ChannelDetail,
	RuleDiff,
	RuleStatus,
} from '@/types'
import { MASS_REMOVAL_THRESHOLD } from '@/utils/raven/constants'
import type { MappingRow } from '@/composables/raven/useMappingList'
import {
	fromApiRule,
	membershipSignature,
	toApiRule,
} from '@/utils/raven/ruleAdapter'

type MappingDetail = WorkspaceDetail | ChannelDetail

const props = defineProps<{
	entity: 'workspace' | 'channel'
	/** The selected row. Its mapping may not exist yet (unmapped workspace). */
	row: MappingRow
	/** Adopt an unmapped row into a mapping, returning its (new) docname. */
	ensureMapped: (row: MappingRow) => Promise<string>
}>()

const isWorkspace = props.entity === 'workspace'
const targetDoctype = isWorkspace
	? 'Raven Workspace Mapping'
	: 'Raven Channel Mapping'

// Null until the row is adopted. Drives the detail fetch and every write target.
const name = computed<string | null>(() => props.row.name)

const rules = ref<RavenMemberRule[]>([])

const detail = createResource<MappingDetail>({
	url: `raven_integration.api.get_${props.entity}`,
	onSuccess(d: MappingDetail) {
		rules.value = (d.member_rules ?? []).map(fromApiRule)
	},
})

function reload(): void {
	if (name.value) detail.submit({ name: name.value })
}

// A mapped row fetches its detail; an unmapped one has none yet, so it opens on
// an empty ruleset. Adding the first rule adopts it (see persistRules).
//
// Also refetch when the combinator (All (AND) / Any (OR)) flips: it is switched from
// the sibling list row, which reloads only the list, so member_count would otherwise
// go stale. Watching both in ONE watch fires once per flush even when a row switch
// changes name and combinator together, so it never double-fetches.
watch(
	[name, () => props.row.rule_combinator],
	([current]) => {
		if (current) {
			reload()
		} else {
			rules.value = []
			detail.reset()
		}
	},
	{ immediate: true }
)

const update = createResource({
	url: `raven_integration.api.update_${props.entity}`,
	onSuccess() {
		reload()
	},
	onError(err: { messages?: string[] }) {
		toast.error(err?.messages?.[0] ?? __('Error saving rules'))
	},
})

// Writes the one status field. Never replaces the rule list, so it cannot delete a
// sibling, and it still works while an invalid saved rule blocks the panel's save.
const setStatus = createResource({
	url: `raven_integration.api.set_${props.entity}_rule_status`,
	onSuccess() {
		reload()
	},
	onError(err: { messages?: string[] }) {
		toast.error(err?.messages?.[0] ?? __('Error updating rule status'))
		reload()
	},
})

function onSetStatus(ruleName: string, status: RuleStatus): void {
	if (!name.value) return
	setStatus.submit({ name: name.value, rule: ruleName, status })
}

function updateParams(
	d: MappingDetail,
	next: RavenMemberRule[]
): Record<string, unknown> {
	const base = {
		name: d.name,
		// Resend the current combinator so saving rules doesn't reset it to the default.
		combinator: d.rule_combinator,
		rules: next.map(toApiRule),
	}
	return 'workspace_label' in d
		? { ...base, label: d.workspace_label, type: d.workspace_type }
		: { ...base, label: d.channel_label, type: d.channel_type }
}

function applyRules(next: RavenMemberRule[]): void {
	const d = detail.data
	if (!d) return
	update.submit(updateParams(d, next))
}

// First rules on a just-adopted mapping: detail isn't loaded, so label/type/
// combinator come from the row.
function applyRulesFor(mappingName: string, next: RavenMemberRule[]): void {
	update.submit({
		name: mappingName,
		combinator: props.row.rule_combinator ?? 'Any (OR)',
		label: props.row.label,
		type: props.row.type,
		rules: next.map(toApiRule),
	})
}

// Before applying a rule change that actually moves people, ask the backend who
// it would drop. Anything at or above the threshold needs confirmation first.
const pendingRules = ref<RavenMemberRule[] | null>(null)
// Set only while the pending write targets a just-adopted mapping, whose detail
// has not been fetched. Everything else writes against `detail`.
const pendingAdopted = ref<string | null>(null)
// True while the pending change deleted a rule: removing a rule is an explicit
// destructive act, so confirm on *any* member drop, not only past the threshold.
const pendingFromRemoval = ref(false)
const massRemoval = ref<RuleDiff | null>(null)
const massRemovalOpen = ref(false)

function clearPending(): void {
	pendingRules.value = null
	pendingAdopted.value = null
	pendingFromRemoval.value = false
}

function applyPending(next: RavenMemberRule[]): void {
	const adopted = pendingAdopted.value
	clearPending()
	if (adopted) applyRulesFor(adopted, next)
	else applyRules(next)
}

const ruleDiff = createResource<RuleDiff>({
	url: 'raven_integration.api.compute_rule_diff',
	onSuccess(diff: RuleDiff) {
		const next = pendingRules.value
		if (!next) return
		// Removing a rule confirms on any drop; other edits only past the threshold.
		const threshold = pendingFromRemoval.value ? 1 : MASS_REMOVAL_THRESHOLD
		if (diff.removed >= threshold) {
			massRemoval.value = diff
			massRemovalOpen.value = true
			return
		}
		applyPending(next)
	},
	onError(err: { messages?: string[] }) {
		// Never apply a membership change we could not preview. The point of the
		// diff is to catch the ones that empty a workspace.
		clearPending()
		toast.error(
			err?.messages?.[0] ?? __('Could not check who this change affects')
		)
		reload()
	},
})

function previewThenApply(
	mappingName: string,
	next: RavenMemberRule[],
	adopted: string | null = null,
	fromRemoval = false
): void {
	pendingRules.value = next
	pendingAdopted.value = adopted
	pendingFromRemoval.value = fromRemoval
	ruleDiff.submit({
		target_doctype: targetDoctype,
		name: mappingName,
		new_rules: next.map(toApiRule),
	})
}

async function persistRules(
	next: RavenMemberRule[],
	options?: { fromRemoval?: boolean }
): Promise<void> {
	// Unmapped workspace: the first rule adopts the row (link_workspace), then
	// persists onto it. Adopting can also RECOVER a mapping another admin created
	// in the meantime, whose rules and members this write would replace, so the
	// diff still gates it. A genuinely fresh mapping has nobody to remove and
	// comes straight back through.
	if (!props.row.mapped) {
		let mappingName: string
		try {
			mappingName = await props.ensureMapped(props.row)
		} catch {
			return // adopt failed; the list already surfaced the error
		}
		previewThenApply(mappingName, next, mappingName)
		return
	}
	const d = detail.data
	if (!d?.name) return
	// Renaming a rule moves nobody, so skip the diff round-trip: it re-evaluates
	// every rule against the whole user base.
	if (membershipSignature(next) === membershipSignature(rules.value)) {
		applyRules(next)
		return
	}
	previewThenApply(d.name, next, null, options?.fromRemoval ?? false)
}

function onMassRemovalConfirm(): void {
	const next = pendingRules.value
	if (next) applyPending(next)
	else clearPending()
}

function onMassRemovalCancel(): void {
	clearPending()
	// Drop the local edit and go back to what is actually stored.
	reload()
}

function onRulesPersist(
	next: RavenMemberRule[],
	options?: { fromRemoval?: boolean }
): void {
	persistRules(next, options)
}

// Labels fall back to the row so the panel is titled even before the detail
// lands (or when the row is still unmapped and has no detail at all).
const label = computed<string>(() => {
	const d = detail.data
	if (d) return 'workspace_label' in d ? d.workspace_label : d.channel_label
	return props.row.label
})

// Detail is authoritative once loaded; the row covers the not-yet-fetched window.
const combinator = computed<string>(
	() => detail.data?.rule_combinator ?? props.row.rule_combinator ?? 'Any (OR)'
)

const targetLabel = computed<string>(() =>
	isWorkspace ? label.value : `#${label.value}`
)

const title = computed<string>(() =>
	isWorkspace
		? __('Workspace rules · {0}').format(label.value)
		: __('Channel rules · #{0}').format(label.value)
)

const subtitle = computed<string>(() => {
	const d = detail.data
	if (!d || !('member_count' in d)) return ''
	return __('{0} members').format(d.member_count)
})

const description = computed<string>(() =>
	isWorkspace
		? __(
				'Users who match these rules are kept in sync as members of this Raven workspace.'
		  )
		: __(
				'Channel members are the workspace members who also match these rules.'
		  )
)

// Mirrors the backend's {'skipped': True, 'reason': 'no_active_rules'}, otherwise
// invisible here. Empty until detail lands so the warning doesn't flash mid-fetch.
const noActiveRulesMessage = computed<string>(() => {
	if (!detail.data) return ''
	return isWorkspace
		? __(
				'No active rules. Membership is not being synced, so this workspace stays as it is.'
		  )
		: __(
				'No active rules. This channel is not being synced. Add a rule to scope its membership.'
		  )
})
</script>

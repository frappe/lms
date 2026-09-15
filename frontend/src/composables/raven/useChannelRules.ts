// The conditions of one channel mapping: the tree the builder edits, the drafts
// that ride along with it, and the confirmation gate between either of those and
// a membership change. The tree is the component's to mutate; what lives here is
// what it cannot know, which rule types exist, which conditions are unfinished,
// and what saving one costs in members.
import { createResource, toast } from 'frappe-ui'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
	autoRuleLabel,
	defaultsOf,
	hasRequiredFields,
	hasUndeclaredFields,
	isDeclaredRuleType,
	isForeignRule,
	useProviderDeclarations,
	useProviderRuleTypes,
	useRuleTypeChoices,
} from '@/composables/raven/providerSchema'
import {
	LMS_PROVIDER,
	emptyRuleTree,
	fromApiTree,
	isRuleGroup,
	pathKey,
	ruleLeaves,
	toApiTree,
} from '@/utils/raven/ruleAdapter'
import type {
	ApiRuleGroup,
	ChannelDetail,
	ChannelVisibility,
	RavenMemberRule,
	RuleDiff,
	RuleGroup,
	RuleNode,
	RulePath,
	RuleStatus,
} from '@/types'

const TARGET_DOCTYPE = 'Raven Channel Mapping'

/** Which of the three checks a condition failed. */
export type RuleProblemKind = 'undeclared' | 'incomplete'

/** Why one condition cannot be saved yet. The kind alone: the section under the builder words one message per kind, and the row carries only `aria-invalid` and a pointer at it. */
export interface RuleProblem {
	kind: RuleProblemKind
}

export interface ChannelRules {
	detail: ComputedRef<ChannelDetail | null>
	/** The page stands for a channel that does not exist yet: Save reads Create. */
	isNew: ComputedRef<boolean>
	loading: ComputedRef<boolean>
	/** Draft name. Part of the same dirty state as the conditions, so Save commits it. */
	labelDraft: Ref<string>
	/** Draft visibility, on the same footing as labelDraft. */
	typeDraft: Ref<ChannelVisibility>
	/** The condition tree. Bound straight to the builder's v-model. */
	tree: Ref<RuleGroup>
	/** Empty while the provider declarations are still loading or unavailable. */
	declarationsUnavailable: ComputedRef<boolean>
	noConditionTypes: ComputedRef<boolean>
	/** Path key → why that condition cannot be saved yet. */
	invalid: ComputedRef<Map<string, RuleProblem>>
	dirty: ComputedRef<boolean>
	/** Enough is filled in for the button to commit, what disables Save/Create. */
	canSubmit: ComputedRef<boolean>
	saving: ComputedRef<boolean>
	/** Factory the builder calls for a new row; null while nothing is declared. */
	newCondition: () => RavenMemberRule
	save: () => void
	reload: () => void
	/** Bind to the confirm dialog: a change that moves people asks first. */
	confirmOpen: Ref<boolean>
	diff: Ref<RuleDiff | null>
	confirm: () => void
	cancel: () => void
}

export function useChannelRules(
	name: () => string | null,
	options: {
		/** The mapping's docname is derived from its label, so saving a rename moves
		 *  it. The owner has to adopt the new one or every later request on the page
		 *  is addressed to a doc that no longer exists. */
		onRenamed?: (newName: string) => void
		/** The workspace mapping a new channel is created under. Only read while
		 *  there is no channel yet, an existing one already names its own. */
		workspace?: () => string
		/** The docname create_channel answered with. The owner adopts it, which
		 *  turns this page into the ordinary detail page for what was just made. */
		onCreated?: (newName: string) => void
	} = {}
): ChannelRules {
	// New is a page, not a write: Create used to POST create_channel on click and
	// leave a live Raven channel behind before anything had been filled in.
	const isNew = computed<boolean>(() => !name())

	const declarations = useProviderDeclarations()
	const ruleTypes = useProviderRuleTypes(() => LMS_PROVIDER)
	const choices = useRuleTypeChoices()

	const tree = ref<RuleGroup>(emptyRuleTree())
	// Name and visibility are drafts like the conditions, not fields that write on
	// change. They used to autosave while Save committed only the conditions, so
	// this page behaved unlike its sibling and broke the no-autosave rule.
	const labelDraft = ref('')
	const typeDraft = ref<ChannelVisibility>('Private')
	/** Which mapping the drafts currently hold. Null until the first load lands. */
	let draftsFor: string | null = null

	const detailResource = createResource<ChannelDetail>({
		url: 'raven_integration.api.get_channel',
		onSuccess(d: ChannelDetail) {
			// A record already on screen keeps its unsaved draft: a reload can come
			// from something that is not a save (the Enabled toggle reloads on both
			// success and failure), and reseeding would drop edits silently. Keyed on
			// the docname, not on `dirty` alone: before the first load there is no
			// saved signature, so `dirty` reads true and would skip the load that
			// fills the page. A load for a different record is a navigation and wins.
			if (draftsFor === d.name && dirty.value) return
			tree.value = fromApiTree(d.rules as ApiRuleGroup)
			labelDraft.value = d.channel_label ?? ''
			typeDraft.value = d.channel_type ?? 'Private'
			draftsFor = d.name
			// What came back is by definition what is saved, so the page opens clean.
			markSaved()
		},
		onError(err: { messages?: string[] }) {
			// Without this the page keeps `data === null` while `loading` goes false,
			// and the form renders an empty Name and a defaulted Visibility as though
			// they were the channel's saved settings.
			toast.error(err?.messages?.[0] ?? __('Could not load this channel'))
		},
	})

	function load(target: string): void {
		detailResource.submit({ name: target })
	}

	function reload(): void {
		const current = name()
		if (current) {
			load(current)
			return
		}
		// Nothing to fetch. The drafts stand for a record that does not exist yet, so
		// they start empty and clean rather than holding whatever was on screen
		// before, and typing into them is what makes the page dirty.
		tree.value = emptyRuleTree()
		labelDraft.value = ''
		typeDraft.value = 'Private'
		draftsFor = null
		detailResource.reset()
		markSaved()
	}

	const detail = computed<ChannelDetail | null>(
		() => detailResource.data ?? null
	)
	const loading = computed<boolean>(() => detailResource.loading)

	const declarationsUnavailable = computed<boolean>(
		() => choices.value.length === 0 && !declarations.loading
	)

	// The same emptiness, without waiting for the request to settle. What the UI
	// gates on has to be true DURING the fetch as well: `declarationsUnavailable`
	// is false while it is in flight, so Add Condition stayed live in that window
	// and a click there appended a row with an empty rule_type that `invalid`
	// skips wholesale, Save enabled on a row the backend refuses. The settled
	// form stays for save()'s message, which should only accuse the load of
	// failing once it has.
	const noConditionTypes = computed<boolean>(() => choices.value.length === 0)

	// Mirrors the backend's own checks so a condition is never round-tripped to an
	// error: an undeclared type or vocabulary, or a required field left empty. A
	// restatement is not one of them: it adds people who are added already.
	const invalid = computed<Map<string, RuleProblem>>(() => {
		const out = new Map<string, RuleProblem>()
		if (!choices.value.length) return out
		const visit = (group: RuleGroup, path: RulePath): void => {
			group.conditions.forEach((node: RuleNode, index: number) => {
				const here = [...path, index]
				if (isRuleGroup(node)) {
					visit(node, here)
					return
				}
				// Another app's rule is neither ours to judge nor ours to fix.
				if (isForeignRule(node)) return
				const key = pathKey(here)
				if (
					!isDeclaredRuleType(ruleTypes.value, node.rule_type) ||
					hasUndeclaredFields(ruleTypes.value, node)
				) {
					out.set(key, { kind: 'undeclared' })
					return
				}
				if (!hasRequiredFields(ruleTypes.value, node)) {
					out.set(key, { kind: 'incomplete' })
				}
			})
		}
		visit(tree.value, [])
		return out
	})

	/** The tree as it would be saved: every unnamed condition gets its derived name. */
	function payload(): RuleGroup {
		const named = (node: RuleNode): RuleNode =>
			isRuleGroup(node)
				? { ...node, conditions: node.conditions.map(named) }
				: {
						...node,
						// The row has no name box, so the label is derived from what it says.
						label: node.label?.trim() || autoRuleLabel(ruleTypes.value, node),
				  }
		return named(tree.value) as RuleGroup
	}

	// Takes its three parts rather than reading the drafts, because its caller is
	// describing a write already in flight. Read live, an edit made while the save
	// travelled was marked saved, and the reload that follows overwrote it.
	function signature(label: string, type: string, value: RuleGroup): string {
		return JSON.stringify([label.trim(), type, toApiTree(value)])
	}

	function currentSignature(): string {
		return signature(labelDraft.value, typeDraft.value, payload())
	}

	const savedSignature = ref('')

	const dirty = computed<boolean>(
		() => currentSignature() !== savedSignature.value
	)

	function markSaved(sent?: string): void {
		savedSignature.value = sent ?? currentSignature()
	}

	/** What the in-flight write will make saved, captured before it leaves. */
	const inFlightSignature = ref<string | null>(null)

	const update = createResource({
		url: 'raven_integration.api.update_channel',
		// The endpoint returns the docname, which changes whenever the label does
		// (`autoname: format:RCM-{channel_label}`).
		onSuccess(newName: string) {
			// Clean only as far as what was SENT. An edit made while this was in
			// flight stays dirty and survives the reload below.
			markSaved(inFlightSignature.value ?? undefined)
			inFlightSignature.value = null
			// One Save commits the name, the visibility and the conditions together.
			toast.success(__('Channel saved'))
			const previous = name()
			const next = typeof newName === 'string' && newName ? newName : previous
			if (!next) return
			if (next !== previous) options.onRenamed?.(next)
			// Loaded by the name the server just gave us rather than through name(),
			// which still reads the old prop until the owner's update propagates.
			load(next)
		},
		onError(err: { messages?: string[] }) {
			inFlightSignature.value = null
			toast.error(err?.messages?.[0] ?? __('Could not save the channel'))
		},
	})

	// create_channel takes the whole rule tree, so conditions authored before
	// Create are saved with it, which is why the New page keeps the builder.
	const create = createResource({
		url: 'raven_integration.api.create_channel',
		onSuccess(newName: string) {
			markSaved(inFlightSignature.value ?? undefined)
			inFlightSignature.value = null
			toast.success(__('Channel created'))
			if (typeof newName !== 'string' || !newName) return
			options.onCreated?.(newName)
			// By the name the server just gave us: name() still reads the empty prop
			// until the owner's adoption propagates.
			load(newName)
		},
		onError(err: { messages?: string[] }) {
			inFlightSignature.value = null
			toast.error(err?.messages?.[0] ?? __('Could not create the channel'))
		},
	})

	// One of ours, not whichever the declaration listed first: list_providers
	// guarantees no ordering, and a foreign rule type freezes the row while
	// `invalid` skips foreign rules, so the empty condition saved.
	//
	// Seeded with the declared defaults, as RuleCondition.setRuleType seeds a
	// retyped row. Without them the row reads "Any" for a non-`reqd` Select while
	// saving no such key, so a fresh row and a retyped one would differ.
	function newCondition(): RavenMemberRule {
		const ours = choices.value.find((c) => c.provider === LMS_PROVIDER)
		const ruleType = ours?.type ?? ''
		return {
			provider: LMS_PROVIDER,
			rule_type: ruleType,
			status: 'Active' as RuleStatus,
			...defaultsOf(ruleTypes.value, ruleType),
		}
	}

	/** The pending write, held while the confirmation dialog is open. */
	const pending = ref<RuleGroup | null>(null)
	const diff = ref<RuleDiff | null>(null)
	const confirmOpen = ref(false)

	function apply(): void {
		const held = pending.value
		const target = name()
		pending.value = null
		confirmOpen.value = false
		if (!held || !target || !detail.value) return
		// Captured here, not read back in onSuccess: this is what the write makes
		// saved, and the drafts may have moved on by the time the reply lands.
		inFlightSignature.value = signature(labelDraft.value, typeDraft.value, held)
		update.submit({
			name: target,
			// The drafts, not the stored values: this one call is what commits a
			// rename and a visibility change now that neither writes on its own.
			// Empty is rejected in save(), so there is nothing to fall back to here.
			label: labelDraft.value.trim(),
			type: typeDraft.value,
			rules: toApiTree(held),
		})
	}

	const diffResource = createResource<RuleDiff>({
		url: 'raven_integration.api.compute_rule_diff',
		onSuccess(result: RuleDiff) {
			if (!pending.value) return
			// Any removal at all is worth a confirmation: saving is one explicit act,
			// not a stream of small writes for a threshold to filter. `unknown`
			// counts as one, because its zeros mean the diff could not be worked out.
			// Asked rather than blocked: an unevaluable tree is usually the one the
			// user came to fix, and removing the broken condition is a save.
			if (result.removed > 0 || result.unknown) {
				diff.value = result
				confirmOpen.value = true
				return
			}
			apply()
		},
		onError(err: { messages?: string[] }) {
			// Never apply a membership change we could not preview.
			pending.value = null
			toast.error(
				err?.messages?.[0] ?? __('Could not check who this change affects')
			)
		},
	})

	const saving = computed<boolean>(
		() => update.loading || diffResource.loading || create.loading
	)

	// Create needs a name and finished conditions; Save needs something to send as
	// well. The auto-named fallback the backend still offers API callers has no UI
	// caller any more, so an empty name is never committed from here.
	const canSubmit = computed<boolean>(
		() =>
			invalid.value.size === 0 &&
			(isNew.value ? !!labelDraft.value.trim() : dirty.value)
	)

	function save(): void {
		// The name lives behind this Save too, so a refusal has to say so rather
		// than leave the button doing nothing.
		if (!labelDraft.value.trim()) {
			toast.error(__('Give this channel a name before saving'))
			return
		}
		// Only the conditions need the declarations. A page with none can still
		// commit a rename, and one that does have them says why it cannot.
		if (declarationsUnavailable.value && ruleLeaves(tree.value).length > 0) {
			toast.error(
				__(
					'Condition types could not be loaded. Reload the page and try again.'
				)
			)
			return
		}
		if (invalid.value.size > 0) {
			toast.error(__('Fix the problems listed under the conditions first'))
			return
		}
		const proposed = payload()
		if (isNew.value) {
			const parent = options.workspace?.()
			// The workspace rides down with the page, so its absence is a broken
			// route rather than something the form can fix. Silence here read as a
			// Create button that does nothing at all.
			if (!parent) {
				toast.error(
					__(
						"No workspace to create this channel in. Go back and start again from a workspace's Channels tab."
					)
				)
				return
			}
			// Straight past the diff gate: a channel that does not exist has no
			// members, so a mass-removal confirmation has nothing to warn about.
			inFlightSignature.value = signature(
				labelDraft.value,
				typeDraft.value,
				proposed
			)
			create.submit({
				workspace: parent,
				label: labelDraft.value.trim(),
				type: typeDraft.value,
				rules: toApiTree(proposed),
			})
			return
		}
		const target = name()
		if (!target) return
		pending.value = proposed
		diffResource.submit({
			target_doctype: TARGET_DOCTYPE,
			name: target,
			new_rules: toApiTree(proposed),
		})
	}

	function cancel(): void {
		pending.value = null
		confirmOpen.value = false
	}

	return {
		detail,
		isNew,
		loading,
		labelDraft,
		typeDraft,
		tree,
		declarationsUnavailable,
		noConditionTypes,
		invalid,
		dirty,
		canSubmit,
		saving,
		newCondition,
		save,
		reload,
		confirmOpen,
		diff,
		confirm: apply,
		cancel,
	}
}

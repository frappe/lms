<template>
	<SettingsLayout :title="title" :show-back="true" @back="requestBack">
		<template #title-badge>
			<Badge
				v-if="rules.dirty.value"
				variant="subtle"
				theme="orange"
				size="sm"
				:label="__('Not Saved')"
			/>
		</template>

		<template #header-actions>
			<Switch
				v-if="!isNew && rules.detail.value"
				size="sm"
				:label="__('Enabled')"
				:model-value="enabled"
				:disabled="locked"
				@update:model-value="toggleEnabled"
			/>
			<Button
				variant="solid"
				:label="__('Save')"
				:disabled="!rules.canSubmit.value || locked"
				:loading="rules.saving.value"
				@click="rules.save"
			/>
		</template>

		<div
			v-if="rules.loading.value && !rules.detail.value && !isNew"
			class="flex h-full items-center justify-center"
		>
			<LoadingIndicator class="w-4" />
		</div>

		<template v-else-if="rules.detail.value || isNew">
			<div class="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
				<FormControl
					v-model="rules.labelDraft.value"
					type="text"
					size="sm"
					variant="subtle"
					:required="true"
					:label="__('Name')"
					:placeholder="__('Name')"
					:disabled="locked"
					maxlength="140"
				/>
				<FormControl
					v-model="rules.typeDraft.value"
					type="select"
					size="sm"
					variant="subtle"
					:required="true"
					:label="__('Visibility')"
					:options="channelTypeOptions"
					:disabled="locked"
				/>
			</div>

			<hr class="my-8 border-outline-gray-2" />

			<div>
				<div class="flex flex-col gap-1">
					<span class="text-lg-semibold text-ink-gray-8">
						{{ __('Membership conditions') }}
					</span>
					<span class="text-p-sm text-ink-gray-6">
						{{
							__(
								'Anyone matching these is kept in this channel, and in its workspace.'
							)
						}}
					</span>
				</div>

				<div class="mt-5">
					<RuleConditions v-if="!locked" :rules="rules" />
					<p v-else class="text-p-sm text-ink-gray-6">
						{{
							__(
								'This channel is missing in Raven, so its conditions cannot be changed.'
							)
						}}
					</p>
				</div>
			</div>
		</template>
	</SettingsLayout>

	<MassRemovalConfirmDialog
		v-model:open="rules.confirmOpen.value"
		:removed-count="rules.diff.value?.removed ?? 0"
		:added-count="rules.diff.value?.added ?? 0"
		:unknown="rules.diff.value?.unknown ?? false"
		:target-label="targetLabel"
		@confirm="rules.confirm"
		@cancel="rules.cancel"
	/>

	<UnsavedChangesDialog v-model:open="leaveOpen" @confirm="leave" />
</template>

<script setup lang="ts">
// Channel detail, built from CRM's Settings/Sla/SlaPolicyView shell.
//
// Gated on `rules.detail.value || isNew`, not on "not loading": a failed load
// leaves data null with loading false, and the fields would render an empty Name
// and a defaulted Visibility as if they were the channel's saved settings.
//
// Name and visibility are drafts inside useChannelRules, so one Save commits them
// with the conditions. Enabled stays immediate: it is the record's state.
//
// The header holds only what acts on the record as a whole. Opening the mapping
// in Raven and deleting it live on its row in the table that led here.
import {
	Badge,
	Button,
	FormControl,
	LoadingIndicator,
	Switch,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import RuleConditions from './RuleConditions.vue'
import MassRemovalConfirmDialog from './MassRemovalConfirmDialog.vue'
import UnsavedChangesDialog from './UnsavedChangesDialog.vue'
import { useChannelRules } from '@/composables/raven/useChannelRules'
import type { ChannelVisibility } from '@/types'

// An empty name is the new-record page: nothing is written until Create is
// clicked. It keeps the conditions editor, because create_channel takes a whole
// rule tree and writes the channel and its conditions in one call.
const props = defineProps<{
	name: string
	label: string
	/** The workspace mapping a new channel is created under. Only read while there
	 *  is no channel yet, an existing one already names its own. */
	workspace?: string
}>()
const emit = defineEmits<{
	back: []
	/** Saving a rename moves the mapping's docname; the owner holds it. */
	renamed: [name: string]
	/** The docname Create produced, adopted the same way a rename is. */
	created: [name: string]
}>()

const CHANNEL_TYPES: ChannelVisibility[] = ['Public', 'Private', 'Open']

const isNew = computed<boolean>(() => !props.name)

const rules = useChannelRules(() => props.name, {
	onRenamed: (next) => emit('renamed', next),
	workspace: () => props.workspace ?? '',
	onCreated: (next) => emit('created', next),
})

// A channel whose Raven record is gone syncs nothing, so its settings are read
// only, the same lock the workspace's General tab has through `form.locked`.
const locked = computed<boolean>(() => !!rules.detail.value?.stale)

watch(() => props.name, rules.reload, { immediate: true })

const title = computed<string>(() =>
	isNew.value
		? __('New Channel')
		: `# ${rules.detail.value?.channel_label ?? props.label}`
)

// Going back with edits in hand asks first. A half-filled new record counts:
// `rules.dirty` reads true on any typed name or added condition, because the
// composable marks the empty new page as its own saved state.
const leaveOpen = ref(false)

function requestBack(): void {
	if (!rules.dirty.value) {
		emit('back')
		return
	}
	leaveOpen.value = true
}

function leave(): void {
	leaveOpen.value = false
	emit('back')
}

const targetLabel = computed<string>(() => title.value)

const enabled = computed<boolean>(() => !!rules.detail.value?.enabled)

const channelTypeOptions = CHANNEL_TYPES.map((type) => ({
	label: __(type),
	value: type,
}))

function onError(fallback: string) {
	return (err: { messages?: string[] }): void => {
		toast.error(err?.messages?.[0] ?? fallback)
		rules.reload()
	}
}

const setEnabled = createResource({
	url: 'raven_integration.api.set_channel_enabled',
	onSuccess() {
		rules.reload()
	},
	onError: onError(__('Could not update the channel')),
})

function toggleEnabled(): void {
	setEnabled.submit({ name: props.name, enabled: !enabled.value })
}
</script>

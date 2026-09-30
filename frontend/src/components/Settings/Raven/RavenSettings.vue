<template>
	<ChannelView
		v-if="ready && screen === 'channel' && channel"
		:name="channel.name"
		:label="channel.label"
		:workspace="channel.workspace"
		@back="closeChannel"
		@renamed="adoptChannelName"
		@created="adoptChannelName"
	/>

	<WorkspaceView
		v-else-if="ready && screen === 'workspace' && workspace"
		:name="workspace.name"
		:label="workspace.label"
		@back="closeWorkspace"
		@renamed="adoptWorkspaceName"
		@created="adoptWorkspaceName"
		@open-channel="openChannel"
		@new-channel="openNewChannel"
	/>

	<WorkspaceList
		v-else-if="ready"
		:label="label"
		:description="description"
		@open="openWorkspace"
		@new="openNewWorkspace"
	/>

	<SettingsLayout
		v-else-if="!setup.loading"
		:title="__(label)"
		:description="__(description)"
	>
		<template #title-badge>
			<Badge
				v-if="!notPermitted && missingApp"
				variant="subtle"
				theme="gray"
				size="sm"
				:label="__('Not installed')"
			/>
		</template>

		<div v-if="notPermitted" class="flex grow items-center justify-center px-4">
			<p class="max-w-md text-center text-p-base text-ink-gray-6">
				{{
					__(
						'You need the System Manager role to manage the Raven integration.'
					)
				}}
			</p>
		</div>

		<RavenSetupRow
			v-else
			:missing="missingApp"
			:loading="enableIntegration.loading"
			@enable="enableIntegration.submit()"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
// A detail page replaces the panel rather than nesting inside it, so it owns its
// own SettingsLayout and back control. Same shape as CRM's SlaConfig, which
// swaps SlaPolicyList for SlaPolicyView on one `step` ref.
//
// A missing app is a badge on the title and a sentence under the row, the way
// Helpdesk marks a missing ERPNext (ERPNextIntegrationSettings.vue); the panel
// keeps its shape either way. The one takeover left is `notPermitted`: a
// moderator without the role has nothing to read and nothing to do, so there is
// no row to show them. Centred with flex, because the translate-x trick CRM and
// Helpdesk use is banned here for RTL.
import { Badge, createResource, toast } from 'frappe-ui'
import { computed, ref } from 'vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import RavenSetupRow from './RavenSetupRow.vue'
import WorkspaceList from './WorkspaceList.vue'
import WorkspaceView from './WorkspaceView.vue'
import ChannelView from './ChannelView.vue'
import type { MappingRow } from '@/composables/raven/useMappingList'
import type { RavenSetupState } from '@/types'

// Settings.vue passes every panel a label/description; declaring them keeps them out
// of $attrs, where `description` would fall through and override SettingsLayout's.
defineProps<{ label: string; description: string }>()

// Endpoints are System Manager-only but Settings opens for any moderator. Its own
// state, else they get the "not set up" card telling them to fix what they can't.
const notPermitted = ref(false)

// LMS, not raven_integration: calling a method of an app that is not installed
// raises AppNotInstalledError, and frappe-ui dumps the server traceback and
// rethrows before onError runs. See lms.raven_provider.get_raven_setup.
const setup = createResource<RavenSetupState>({
	url: 'lms.raven_provider.get_raven_setup',
	auto: true,
	onError(err: { exc_type?: string }) {
		notPermitted.value = err?.exc_type === 'PermissionError'
	},
})

// Which app is missing, if any. `raven_integration` first: without it there is no
// endpoint to ask about Raven, so reporting Raven as missing would be a guess.
const missingApp = computed<'raven' | 'raven_integration' | null>(() => {
	if (!setup.data?.raven_integration) return 'raven_integration'
	if (!setup.data?.raven) return 'raven'
	return null
})

// True while either app is missing or the integration is not yet enabled. Only
// the second of those is a centered card; a missing app is a banner.
const needsSetup = computed(
	(): boolean => !!missingApp.value || !setup.data?.enabled
)

// Set up and permitted, the panel is only its list, and the list is a
// SettingsList, which brings its own SettingsLayout, heading and Create button,
// exactly as the panels either side of this one do. The SettingsLayout in the
// template is what is left: the states where there is no list to show.
const ready = computed(
	(): boolean => !needsSetup.value && !notPermitted.value && !setup.loading
)

// One-way enable (no disable).
const enableIntegration = createResource({
	url: 'raven_integration.api.enable_integration',
	onSuccess() {
		setup.reload()
	},
	onError(err: { messages?: string[] }) {
		toast.error(err?.messages?.[0] ?? __('Could not enable the integration'))
	},
})

/** Which of the three screens is showing. A channel always has a workspace behind it. */
type Screen = 'list' | 'workspace' | 'channel'

/**
 * Which record a screen is showing. An empty `name` is the new-record page: New
 * routes to the detail page and nothing is written until Create is clicked.
 */
interface Target {
	name: string
	label: string
	/** Channel targets only: the workspace mapping a new channel is created under. */
	workspace?: string
}

const screen = ref<Screen>('list')
const workspace = ref<Target | null>(null)
const channel = ref<Target | null>(null)

function openWorkspace(row: MappingRow): void {
	if (!row.name) return
	workspace.value = { name: row.name, label: row.label }
	screen.value = 'workspace'
}

function openNewWorkspace(): void {
	workspace.value = { name: '', label: '' }
	screen.value = 'workspace'
}

// The three screens are branches of one v-if, so leaving a detail page builds the
// list again from nothing. Its records resource is created with the component and
// fetches on creation, which is what picks up a label or visibility edit made on
// the page being left, there is no surviving instance here to reload, and asking
// the new one would only repeat the fetch it has already made.
function closeWorkspace(): void {
	workspace.value = null
	channel.value = null
	screen.value = 'list'
}

function openChannel(row: MappingRow): void {
	if (!row.name) return
	channel.value = { name: row.name, label: row.label }
	screen.value = 'channel'
}

// The Channels tab's Create, travelled up through WorkspaceView. It carries the
// workspace mapping's docname because that is what create_channel is given, and
// the new-channel page has no record of its own to read it off.
function openNewChannel(workspaceName: string): void {
	if (!workspaceName) return
	channel.value = { name: '', label: '', workspace: workspaceName }
	screen.value = 'channel'
}

// The mapping's docname is derived from its label, so a saved rename moves it.
// Holding the old one would address every later request to a doc that is gone.
function adoptChannelName(next: string): void {
	if (channel.value) channel.value = { ...channel.value, name: next }
}

// The workspace mapping autonames the same way, and had no such adoption: a
// rename saved, the docname moved, and the page reloaded under the name it still
// held, which is why renaming a workspace put the old record back on screen
// behind a "not found" toast.
function adoptWorkspaceName(next: string): void {
	if (workspace.value) workspace.value = { ...workspace.value, name: next }
}

function closeChannel(): void {
	channel.value = null
	screen.value = 'workspace'
}
</script>

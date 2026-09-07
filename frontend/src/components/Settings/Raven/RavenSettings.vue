<template>
	<!-- Workspace detail replaces the panel rather than nesting inside it, so it
		 owns its own SettingsLayout and back control. -->
	<ChannelsView
		v-if="
			setup.data?.raven &&
			setup.data?.raven_integration &&
			setup.data?.enabled &&
			selectedWorkspace
		"
		:workspace="selectedWorkspace"
		@back="onBack"
	/>

	<SettingsLayout
		v-else-if="!setup.loading"
		:title="__(label)"
		:description="__(description)"
	>
		<template v-if="!needsSetup" #header-actions>
			<Button variant="solid" @click="openCreateWorkspace">
				<template #prefix><span class="lucide-plus h-4 w-4" /></template>
				{{ __('Create workspace') }}
			</Button>
		</template>

		<!-- Setup states sit where every other empty state does: 35% down, centered,
			 w-4/12 (EmptyStateLayout). Management flows from the top instead. -->
		<div
			v-if="needsSetup"
			class="relative flex h-full min-h-64 w-full grow justify-center"
		>
			<div
				class="absolute inset-x-0 top-[35%] mx-auto flex w-4/12 flex-col items-center gap-3 px-4"
			>
				<p v-if="notPermitted" class="text-center text-p-base text-ink-gray-6">
					{{
						__(
							'You need the System Manager role to manage the Raven integration.'
						)
					}}
				</p>
				<RavenNotInstalledBanner
					v-else-if="!setup.data?.raven_integration"
					missing="raven_integration"
				/>
				<RavenNotInstalledBanner
					v-else-if="!setup.data?.raven"
					missing="raven"
				/>
				<!-- Not-enabled card: one-way connect, no disable toggle. -->
				<template v-else>
					<span class="lucide-messages-square size-7.5 text-ink-gray-5" />
					<div class="flex flex-col items-center gap-1">
						<span class="text-center text-p-lg-medium text-ink-gray-8">
							{{ __('Connect Raven to Frappe Learning') }}
						</span>
						<span class="text-center text-p-base text-ink-gray-6">
							{{
								__(
									'Enable the integration to sync workspace and channel membership from your students and staff.'
								)
							}}
						</span>
					</div>
					<Button
						variant="solid"
						:loading="enableIntegration.loading"
						@click="enableIntegration.submit()"
					>
						{{ __('Enable') }}
					</Button>
				</template>
			</div>
		</div>

		<WorkspaceList
			v-else
			ref="workspaceList"
			@open-channels="onSelectWorkspace"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { Button, createResource, toast } from 'frappe-ui'
import { computed, ref } from 'vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import RavenNotInstalledBanner from './RavenNotInstalledBanner.vue'
import WorkspaceList from './WorkspaceList.vue'
import ChannelsView from './ChannelsView.vue'
import type { RavenSetupState, RavenWorkspace } from '@/types'

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

// True while either app is missing or the integration is not yet enabled. Those
// states render a vertically-centered card.
const needsSetup = computed(
	(): boolean =>
		!setup.data?.raven_integration || !setup.data?.raven || !setup.data?.enabled
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

const selectedWorkspace = ref<RavenWorkspace | null>(null)
const workspaceList = ref<{
	openCreate: () => void
} | null>(null)

function onSelectWorkspace(workspace: RavenWorkspace): void {
	selectedWorkspace.value = workspace
}

function onBack(): void {
	selectedWorkspace.value = null
}

// The create-workspace action lives next to the panel heading; delegate the
// actual dialog/resource to WorkspaceList (which owns them).
function openCreateWorkspace(): void {
	workspaceList.value?.openCreate()
}
</script>

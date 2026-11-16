<template>
	<FormShell :title="__('Add a link')" size="lg" @close="emit('close')">
		<template #default>
			<form class="flex flex-col gap-2" @submit.prevent="submit">
				<FormControl
					v-model="url"
					type="url"
					variant="outline"
					:label="__('Link')"
					placeholder="https://intranet.example.com/policies/posh"
					autofocus
				/>
				<p class="text-p-sm text-ink-gray-6">
					{{
						__(
							'Paste a page Lumi can open without logging in: a policy on your site, a help article, a Google Doc shared with anyone who has the link. Lumi reads that one page and cites it by its title, so for a guide with many pages add the ones people need most.'
						)
					}}
				</p>
				<ErrorMessage :message="addUrl.error" />
			</form>
		</template>
		<template #actions>
			<HeaderButton
				:label="__('Add')"
				variant="solid"
				:disabled="!url.trim()"
				:loading="addUrl.loading"
				@click="submit"
			/>
		</template>
	</FormShell>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import { createResource, ErrorMessage, FormControl } from 'frappe-ui'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'

const props = defineProps<{ goal: string }>()
const emit = defineEmits<{ close: []; added: [sources: unknown[]] }>()

const url = ref('')
// On /skills/new the skill exists only once a course or page is confirmed, so closing
// the dialog leaves nothing behind.
const ensureGoal = inject<() => Promise<string>>('ensureGoal', () =>
	Promise.resolve(props.goal)
)

const addUrl = createResource({
	url: 'lms.lms.ai.api.add_url',
	onSuccess: (sources: unknown[]) => {
		emit('added', sources)
		emit('close')
	},
})

const submit = () => {
	if (url.value.trim())
		ensureGoal().then((goal) => addUrl.submit({ goal, url: url.value.trim() }))
}
</script>

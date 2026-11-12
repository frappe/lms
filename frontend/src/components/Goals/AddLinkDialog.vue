<template>
	<FormShell :title="__('Add a web page')" size="lg" @close="emit('close')">
		<template #default>
			<form class="flex flex-col gap-2" @submit.prevent="submit">
				<FormControl
					v-model="url"
					type="url"
					variant="outline"
					:label="__('Address')"
					placeholder="https://docs.example.com/guides/sales-invoice"
					autofocus
				/>
				<p class="text-p-sm text-ink-gray-6">
					{{
						__(
							'Lumi reads this one page and cites it by its title. For a guide with many pages, add the pages people need most.'
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
import { ref } from 'vue'
import { createResource, ErrorMessage, FormControl } from 'frappe-ui'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'

const props = defineProps<{ goal: string }>()
const emit = defineEmits<{ close: []; added: [sources: unknown[]] }>()

const url = ref('')
const addUrl = createResource({
	url: 'lms.lms.ai.api.add_url',
	onSuccess: (sources: unknown[]) => {
		emit('added', sources)
		emit('close')
	},
})

const submit = () => {
	if (url.value.trim())
		addUrl.submit({ goal: props.goal, url: url.value.trim() })
}
</script>

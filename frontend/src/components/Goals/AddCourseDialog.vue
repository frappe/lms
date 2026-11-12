<template>
	<FormShell :title="__('Add a course')" size="lg" @close="emit('close')">
		<template #default>
			<div class="flex flex-col gap-2">
				<Link
					v-model="course"
					doctype="LMS Course"
					:label="__('Course')"
					:required="true"
					variant="outline"
				/>
				<p class="text-p-sm text-ink-gray-6">
					{{
						__(
							'Lumi reads every lesson and teaches from it. Edits to the course reach the skill on their own.'
						)
					}}
				</p>
				<ErrorMessage :message="addCourse.error" />
			</div>
		</template>
		<template #actions>
			<HeaderButton
				:label="__('Add')"
				variant="solid"
				:disabled="!course"
				:loading="addCourse.loading"
				@click="addCourse.submit({ goal, course })"
			/>
		</template>
	</FormShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createResource, ErrorMessage } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'

defineProps<{ goal: string }>()
const emit = defineEmits<{ close: []; added: [sources: unknown[]] }>()

const course = ref('')
const addCourse = createResource({
	url: 'lms.lms.ai.api.add_course',
	onSuccess: (sources: unknown[]) => {
		emit('added', sources)
		emit('close')
	},
})
</script>

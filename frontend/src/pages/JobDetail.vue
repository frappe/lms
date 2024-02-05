<template>
	<div class="text-base h-screen">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Jobs'), route: { name: 'Jobs' } }]"
			/>
			<div class="flex">
				<Button v-if="user.data?.name" variant="solid">
					<template #prefix>
						<Plus class="h-4 w-4" />
					</template>
					{{ __('New Job') }}
				</Button>
			</div>
		</header>
		<div></div>
	</div>
</template>
<script setup>
import {
	createDocumentResource,
	Button,
	Breadcrumbs,
	createResource,
} from 'frappe-ui'
import { inject } from 'vue'
import { Plus } from 'lucide-vue-next'

const user = inject('$user')

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})
const job = createResource({
	url: 'lms.lms.api.get_job_details',
	params: {
		job: props.job,
	},
	cache: ['job'],
	auto: true,
})
</script>

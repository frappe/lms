<template>
	<PageHeader :breadcrumbs="breadcrumbs">
		<template #actions>
			<slot v-if="ready" name="actions" />
		</template>
	</PageHeader>
	<PageBody>
		<div class="mx-auto w-full max-w-6xl p-5">
			<div
				v-if="state.loading.value && !state.data.value"
				class="flex items-center gap-2 py-10 text-ink-gray-5"
				data-testid="copilot-loading"
			>
				<LoadingIndicator class="size-4" />
				{{ __('Loading…') }}
			</div>
			<TeacherNotice
				v-else-if="state.forbidden.value"
				:title="__('Learning Copilot')"
				:text="__('Only teachers can open this page.')"
			/>
			<TeacherNotice
				v-else-if="state.error.value"
				:title="__('This page could not be loaded')"
				:text="state.error.value"
			/>
			<slot v-else-if="ready" />
		</div>
	</PageBody>
</template>

<script setup>
import { computed } from 'vue'
import { LoadingIndicator } from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import PageBody from '@/components/Layouts/pages/PageBody.vue'
import TeacherNotice from './TeacherNotice.vue'

const props = defineProps({
	breadcrumbs: { type: Array, required: true },
	// The object useTeacherData() returns.
	state: { type: Object, required: true },
	// A screen whose data may legitimately be null (no weekly report yet).
	allowEmpty: { type: Boolean, default: false },
})

const ready = computed(
	() =>
		!props.state.forbidden.value &&
		!props.state.error.value &&
		(props.allowEmpty
			? !props.state.loading.value || props.state.data.value
			: Boolean(props.state.data.value))
)
</script>

<template>
	<div class="flex flex-col h-full text-base overflow-y-hidden">
		<div class="">
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center space-x-2">
					<div class="text-xl font-semibold leading-none text-ink-gray-9">
						{{ __(label) }}
					</div>
					<Badge
						v-if="data.isDirty"
						:label="__('Not Saved')"
						variant="subtle"
						theme="orange"
					/>
				</div>
				<Button variant="solid" :loading="data.save.loading" @click="update">
					{{ __('Update') }}
				</Button>
			</div>
			<div class="text-ink-gray-6 leading-5">
				{{ __(description) }}
			</div>
		</div>

		<SettingFields :sections="sections" :data="data.doc" />
	</div>
</template>

<script setup>
import { Button, Badge, toast } from 'frappe-ui'
import SettingFields from '@/components/Settings/SettingFields.vue'

const props = defineProps({
	sections: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
})

const update = () => {
	props.data.save.submit(
		{},
		{
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>

<style>
.CodeMirror pre.CodeMirror-line,
.CodeMirror pre.CodeMirror-line-like {
	font-family: revert;
}

.CodeMirror {
	border-radius: 12px;
}
</style>

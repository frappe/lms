<template>
	<div class="flex flex-col justify-between h-full">
		<div>
			<div class="flex itemsc-center justify-between">
				<div class="text-xl font-semibold leading-none mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<Badge
					v-if="data.isDirty"
					:label="__('Not Saved')"
					variant="subtle"
					theme="orange"
				/>
			</div>
			<div class="text-xs text-ink-gray-5">
				{{ __(description) }}
			</div>
		</div>

		<SettingFields :fields="fields" :data="data.doc" />
		<div class="flex flex-row-reverse mt-auto">
			<Button variant="solid" :loading="data.save.loading" @click="update">
				{{ __('Update') }}
			</Button>
		</div>
	</div>
</template>

<script setup>
import { Button, Badge, toast } from 'frappe-ui'
import SettingFields from '@/components/SettingFields.vue'

const props = defineProps({
	fields: {
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
	props.fields.forEach((f) => {
		if (f.type == 'Upload') {
			props.data.doc[f.name] = f.value ? f.value.file_url : null
		} else if (f.type != 'Column Break') {
			props.data.doc[f.name] = f.value
		}
	})
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

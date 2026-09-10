<template>
	<Dialog
		v-model:open="show"
		:title="__('Add web page to sidebar')"
		size="lg"
		:actions="[
			{
				label: 'Add',
				variant: 'solid',
				loading: webPage.loading,
				onClick: ({ close }) => {
					addWebPage(close)
				},
			},
		]"
	>
		<template #default>
			<div class="text-base">
				<Link
					v-model="page.webpage"
					doctype="Web Page"
					:label="__('Web Page')"
					:filters="{
						published: 1,
					}"
					:required="true"
				/>
				<IconPicker
					v-model="page.icon"
					:label="__('Icon')"
					class="mt-4"
					:required="true"
				/>
				<ErrorMessage v-if="error" class="mt-4" :message="error" />
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, ErrorMessage, createResource, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { reactive, ref, watch } from 'vue'
import IconPicker from '@/components/Controls/IconPicker.vue'

const sidebar = defineModel('reloadSidebar')
const show = defineModel()
const error = ref('')
const page = reactive({
	icon: '',
	webpage: '',
})

const props = defineProps({
	page: {
		type: Object,
		default: null,
	},
})

const webPage = createResource({
	url: 'lms.lms.api.update_sidebar_item',
	makeParams(values) {
		return {
			webpage: page.webpage,
			icon: page.icon,
		}
	},
})

watch(
	() => props.page,
	(newPage) => {
		if (newPage) {
			page.icon = newPage.icon
			page.webpage = newPage.web_page
		}
	},
	{ immediate: true }
)

watch(
	() => [page.webpage, page.icon, show.value],
	() => {
		error.value = ''
	}
)

const addWebPage = (close) => {
	error.value = ''
	if (!page.webpage || !page.icon) {
		error.value = __('Please fill the required fields')
		return
	}
	webPage.submit(
		{},
		{
			onSuccess() {
				sidebar.value.reload()
				close()
				toast.success(__('Web page added to sidebar'))
			},
			onError(err) {
				error.value = err.message?.[0] || err.messages?.[0] || err
			},
		}
	)
}
</script>

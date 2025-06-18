<template>
	{{ exercise }}
	<Button @click="runCode"> Run Code </Button>
</template>
<script setup lang="ts">
import { Button, createDocumentResource } from 'frappe-ui'
import { onMounted, ref } from 'vue'

const props = defineProps<{
	exerciseID: string
}>()

onMounted(() => {
	loadFalcon()
})

const exercise = createDocumentResource({
	doctype: 'LMS Exercise',
	name: props.exerciseID,
	fields: ['name', 'title', 'description'],
	auto: true,
})

const loadFalcon = () => {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = 'https://falcon.frappe.io/static/livecode.js'
		script.onload = resolve
		script.onerror = reject
		document.head.appendChild(script)
	})
}

const runCode = () => {
	var session = new LiveCodeSession({
		base_url: 'https://falcon.frappe.io',
		runtime: 'python',
		code: "print('hello, world!')",
		onMessage: function (msg: any) {
			console.log(msg)
		},
	})
}
</script>

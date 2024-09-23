<template>
	<div class="p-5 max-w-3xl mx-auto">
		<!-- Content Editable Area -->
		<div
			ref="editor"
			class="border border-gray-300 p-3 rounded-md min-h-[200px] bg-white"
			contenteditable="true"
			@input="onInput"
		></div>
	</div>
</template>

<script setup>
import { ref } from 'vue'

const editor = ref(null)
const htmlContent = ref('')

// Function to execute formatting commands
const execCommand = (command) => {
	document.execCommand(command, false, null)
}

// Watch for input changes
const onInput = () => {
	htmlContent.value = editor.value.innerHTML
}
</script>

<style scoped>
/* You can add custom styles here if needed */
</style>

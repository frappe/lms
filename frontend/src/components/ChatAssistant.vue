<template>
  <div
    v-show="show"
    class="fixed z-50 right-0 w-80 h-[calc(100%_-_300px)] text-ink-gray-9 m-5 mt-[230px] p-3 flex gap-2 flex-col justify-between rounded-lg bg-surface-modal shadow-2xl"
    :class="{ 'top-[calc(100%_-_290px)] border': minimize }"
    @click.stop
  >
    <div class="flex items-center justify-between px-2 py-1.5">
      <div class="text-base font-medium">
		AI Assistant
      </div>
      <div class="flex gap-1">
        <Button @click="minimize = !minimize" variant="ghost">
          <component
            :is="minimize ? Maximize2 : Minimize2"
            class="h-3.5"
          />
        </Button>
      </div>
    </div>
    <div class="h-full overflow-hidden flex flex-col gap-y-2">
		<!-- Chat container -->
		<div class="h-[calc(100%_-_30px)] bg-blue-500 overflow-y-auto rounded bg-surface-gray-1"></div>
		<!-- Chat input -->
		<div class="flex justify-between gap-x-2">
			<TextInput
				:type="'text'"
				:ref_for="true"
				size="md"
				variant="subtle"
				placeholder="Ask me anything"
				:disabled="false"
				modelValue=""
				class="w-full"
			/>
			<button class="rounded bg-blue-500 p-2">
				<SendHorizonalIcon class="h-3.5 text-white"/>
			</button>
		</div>
    </div>
  </div>
</template>
<script setup>
import { Button, TextInput } from 'frappe-ui'
import {
	Minimize2,
	Maximize2,
	SendHorizonalIcon
} from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps({})
const show = defineModel()
const minimize = ref(true)
</script>
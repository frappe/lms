<template>
    <div class="flex text-center">
        <div v-for="index in 5">
            <Star class="h-5 w-5 fill-gray-400 text-gray-200 mr-1 cursor-pointer hover:fill-orange-500" @input="handleChange"/>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { Star } from 'lucide-vue-next'

const props = defineProps({
    id: {
        type: String,
        default: '',
    },
    modelValue: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

let emitChange = (value: string) => {
    emit('update:modelValue', value)
}

let handleChange = (e: Event) => {
    emitChange((e.target as HTMLInputElement).value)
}
</script>

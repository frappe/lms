<template>
    <div class="flex text-center">
        <div v-for="index in 5">
            <Star :class="{'fill-orange-500': index <= rating}"
                class="h-5 w-5 fill-gray-400 text-gray-200 mr-1 cursor-pointer" @click="markRating(index)"/>
        </div>
    </div>
</template>

<script setup>
import { Star } from 'lucide-vue-next'
import { ref } from 'vue'
const props = defineProps({
    id: {
        type: String,
        default: '',
    },
    modelValue: {
        type: Number,
        default: 0,
    },
})

const emit = defineEmits(['update:modelValue'])
let rating = ref(props.modelValue)

let emitChange = (value) => {
    emit('update:modelValue', value)
}

function markRating(index) {
    emitChange(index);
    rating.value = index;
}
</script>

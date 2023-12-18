<template>
    <div class="h-screen">
        this is a batch
    </div>
</template>
<script setup>
const props = defineProps({
    batchName: {
        type: String,
        required: true,
    },
})
</script>
<template>
    <!-- <Dialog
        v-model="show"
    >
        <template>
            This is life
        </template>
    </Dialog> -->
</template>
<script setup>
import { Dialog } from "frappe-ui"
import { computed } from "vue"

const show = defineModel()

const dialogOptions = computed(() => {
    return {
        title: __(props.title),
        size: 'lg',
        actions: [
            {
                label: __('Submit'),
                onClick: (close) => {
                    submitQuestion(close)
                },
            },
        ]
    }
})
</script>
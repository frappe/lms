<template>
    <Dialog v-model="show" :options='{
        title: __("Write a Review"),
        size: "xl",
        actions: [
            {
                label: "Submit",
                variant: "solid",
                onClick: ({ close }) => submitReview(close)
            }
        ]
    }'>
        <template #body-content>
            <Textarea type="text" size="md" rows="5" />
            <Rating />
        </template>
    </Dialog>
</template>
<script setup>
import { Dialog, Textarea } from 'frappe-ui'
import { defineModel } from "vue"
import Rating from '@/components/Rating.vue';

const show = defineModel()
console.log(show)
</script>

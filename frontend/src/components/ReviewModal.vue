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
            <div class="flex flex-col gap-4">
                <div>
                    <div class="mb-1.5 text-sm text-gray-600">
                        {{  __("Rating") }}
                    </div>
                    <Rating v-model="review.rating"/>
                </div>
                <div>
                    <div class="mb-1.5 text-sm text-gray-600">
                        {{  __("Review") }}
                    </div>
                        <Textarea type="text" size="md" rows=5 v-model="review.review"/>
                    </div>
                </div>
        </template>
    </Dialog>
</template>
<script setup>
import { Dialog, Textarea, createResource } from 'frappe-ui'
import { defineModel, ref } from "vue"
import Rating from '@/components/Rating.vue';

const show = defineModel()
const reviews = defineModel("reloadReviews")
let review = ref({})

const createReview = createResource({
    url: "frappe.client.insert",
    makeParams(values) {
        return {
            doc: {
                doctype: "LMS Course Review",
                ...values,
            }
        }
    }
})
function submitReview(close) {
    createReview.submit(review, {
        validate() {
            /* if (!review.value.rating) {
                return __("Please select a rating")
            }
            if (!review.value.review) {
                return __("Please write a review")
            } */
        }, onSuccess() {
            reviews.reload()
        }
    })
    close();
}
</script>

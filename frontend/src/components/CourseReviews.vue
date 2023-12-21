<template>
    <div v-if="reviews.data" class="my-10">
        <div class="text-2xl font-semibold mb-5">
            {{ __("Reviews") }}
        </div>
        <div class="flex justify-between">
            <div class="flex flex-col items-center">
                <div v-if="avg_rating" class="text-3xl font-semibold mb-2">
                    {{ avg_rating }}
                </div>
                <div class="flex mb-2">
                    <Star v-for="index in 5" class="h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-1" :class="(index <= Math.ceil(avg_rating)) ? 'fill-orange-500' : 'fill-gray-600'"/>
                </div>
                <div class="mb-2">
                    {{ reviews.data.length }} {{ __("reviews") }}
                </div>
                <Button @click="openReviewModal()">
                    <span>
                        {{ __("Write a review") }}
                    </span>
                </Button>
            </div>
            <div class="border border-gray-300 mx-4"></div>
            <div class="flex flex-col">
                <div v-for="index in reversedRange(5)">
                    <div class="flex items-center mb-4">
                        <span class="mr-2">
                            {{ index }} {{ __("stars") }}
                        </span>
                        <div class="bg-gray-200 rounded-full w-52 mr-2">
                            <div class="bg-gray-900 h-1 rounded-full" :style="{ width: rating_percent[index] + '%' }"></div>
                        </div>
                        <span>
                            {{ Math.floor(rating_percent[index]) }}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-12">
            <div v-for="(review, index) in reviews.data">
                <div class="my-4">
                    <div class="flex items-center">
                        <UserAvatar :user="review.owner_details" :size="'2xl'"/>
                        <div class="mx-4">
                            <span class="text-lg font-medium mr-4">
                                {{ review.owner_details.full_name }}
                            </span>
                            <span>
                                {{ review.creation }}
                            </span>
                            <div class="flex mt-2">
                                <Star v-for="index in 5" class="h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-2" :class="(index <= Math.ceil(review.rating)) ? 'fill-orange-500' : 'fill-gray-600'"/>
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 leading-5">
                        {{ review.review }}
                    </div>
                </div>
                <div class="mx-3 h-px border-t border-gray-200" v-if="index < reviews.data.length - 1"></div>
            </div>
        </div>
    </div>
    <ReviewModal v-model="showReviewModal" v-model:reloadReviews="reviews"/>
</template>
<script setup>
import { Star } from 'lucide-vue-next'
import { createResource, Button } from "frappe-ui";
import { computed, ref } from "vue";
import UserAvatar from '@/components/UserAvatar.vue';
import ReviewModal from '@/components/ReviewModal.vue';

const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
    avg_rating: {
        type: Number,
        required: true,
    },
});



const reversedRange = (count) => Array.from({ length: count }, (_, index) => count - index);

const reviews = createResource({
    url: "lms.lms.utils.get_reviews",
    cache: ["course_reviews", props.courseName],
    params: {
        course: props.courseName
    },
    auto: true,
});

const rating_percent = computed(() => {
    let rating_count = {};
    let rating_percent = {};

    for (const key of [1, 2, 3, 4, 5]) {
        rating_count[key] = 0;
    }

    for (const review of reviews?.data) {
        rating_count[review.rating] += 1;
    }

    [1,2,3,4,5].forEach((key) => {
        rating_percent[key] = (rating_count[key] / reviews.data.length * 100).toFixed(2);
    });
    return rating_percent;
});
const showReviewModal = ref(false)

function openReviewModal() {
    console.log("called")
    showReviewModal.value = true;
}
</script>
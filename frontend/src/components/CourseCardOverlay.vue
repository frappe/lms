<template>
    <div class="shadow rounded-md"  style="width: 300px;">
        <iframe v-if="course.data.video_link" :src="video_link" class="rounded-t-md" />
        <div class="p-5">
            <Button v-if="course.data.membership" variant="solid" class="w-full mb-3">
                <span>
                    {{ __("Continue Learning") }}
                </span>
            </Button>
            <Button v-else variant="solid" class="w-full mb-3" >
                <span>
                    {{ __("Start Learning") }}
                </span>
            </Button>
            <div class="flex items-center mb-3">
                <Users class="h-4 w-4 text-gray-700"/>
                <span class="ml-1">
                    {{ course.data.enrollment_count_formatted }} {{ __("Enrolled") }}
                </span>
            </div>
            <div class="flex items-center mb-3">
                <BookOpen class="h-4 w-4 text-gray-700"/>
                <span class="ml-1">
                    {{ course.data.lesson_count }} {{ __("Lessons") }}
                </span>
            </div>
            <div class="flex items-center">
                    <Star class="h-4 w-4 fill-orange-500 text-gray-100"/>
                    <span class="ml-1">
                        {{ course.data.avg_rating }} {{ __("Rating") }}
                    </span>
                </div>
        </div>
    </div>
</template>
<script setup>
import { BookOpen, Users, Star } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from "frappe-ui"
const props = defineProps({
    course: {
        type: Object,
        default: null,
    },
});

const video_link = computed(() => {
    if (props.course.data.video_link) {
        return "https://www.youtube.com/embed/" + props.course.data.video_link;
    }
    return null;
});
</script>
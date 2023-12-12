<template>
    <div class="border border-gray-200"  style="width: 300px;">
        <iframe v-if="course.data.video_link" :src="video_link" />
        <div>
            <Button variant="solid" class="w-full">
                <span>
                    {{ __("Start Learning") }}
                </span>
            </Button>
            <div class="flex items-center">
                <Users class="h-4 w-4 text-gray-700"/>
                <span class="ml-1">
                    {{ course.data.enrollment_count }}
                </span>
            </div>
            <div class="flex items-center">
                <Star class="h-5 w-5 fill-orange-500 text-gray-100"/>
                <span class="ml-1">
                    {{ course.data.avg_rating }}
                </span>
            </div>
            <div class="flex items-center">
                <BookOpen class="h-4 w-4 text-gray-700"/>
                <span class="ml-1">
                    {{ course.data.lesson_count }}
                </span>
            </div>
        </div>
    </div>
</template>
<script setup>
import { BookOpen, Users, Star } from 'lucide-vue-next'
import { computed } from 'vue'
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
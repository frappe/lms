<template>
    Lesson Page
</template>
<script setup>
import { createResource, Button } from "frappe-ui";

const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
    lessonNumber: {
        type: Number,
        required: true,
    },
});

const lesson = createResource({
    url: "lms.lms.utils.get_lesson",
    cache: ["lesson", props.courseName, props.lessonNumber],
    params: {
        course: props.courseName,
        lesson: props.lessonNumber,
    },
    auto: true,
});
</script>
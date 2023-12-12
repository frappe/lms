<template>
    {{ outline }}
</template>
<script setup>
import { createResource } from "frappe-ui";
const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
});
console.log(props);
const outline = createResource({
    url: "lms.lms.utils.get_course_outline",
    cache: ["course_outline", props.courseName],
    params: {
        course: props.courseName
    },
    auto: true,
});
</script>
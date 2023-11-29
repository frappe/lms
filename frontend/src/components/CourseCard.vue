<template>
<div class="flex flex-col h-full border border-gray-200 rounded-md shadow-sm mt-5">
    <div class="course-image" :class="{'default-image': !course.image}" :style="{ backgroundImage: 'url(' + course.image + ')' }">
        <div class="flex relative top-4 left-4">
            <div class="course-card-pills rounded-md border border-gray-200" v-for="tag in tags.data">
                {{ tag }}
            </div>
        </div>
        <div v-if="!course.image" class="flex flex-1 text-8xl font-bold">{{ course.title[0] }}</div>
    </div>
    <div class="p-4">
        <div class="text-2xl font-semibold">
            {{ course.title }}
        </div>
        <div>
            {{ course.short_introduction }}
        </div>
    </div>
</div>
</template>
<script setup>
import { createResource } from 'frappe-ui';
const props = defineProps({
    course: {
        type: Object,
        default: null,
    },
})
const tags = createResource({
    url: "lms.lms.utils.get_tags",
    params: { course: props.course.name },
    auto: true,
})

</script>
<style>
.course-image {
  height: 168px;
  width: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.course-card-pills {
	background: #ffffff;
	margin-left: 0;
	margin-right: 0.5rem;
	padding: 3.5px 8px;
	font-size: 11px;
	text-align: center;
	letter-spacing: 0.011em;
	text-transform: uppercase;
	font-weight: 600;
	width: fit-content;
}

.default-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: theme('colors.gray.200');
  color: theme('colors.gray.700');
}
</style>
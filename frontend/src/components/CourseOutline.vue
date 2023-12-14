<template>
    <div class="text-base mt-10">
        <div class="text-2xl font-semibold">
            {{ __("Course Content") }}
        </div>
        <div class="mt-4">
            <Disclosure v-slot="{ open }" v-for="chapter in outline.data" :key="chapter.name">
                <DisclosureButton
                    class="flex w-full px-2 pt-2 pb-2"
                    >
                    <ChevronUp
                        :class="open ? 'rotate-180 transform' : ''"
                        class="h-5 w-5 text-gray-900 stroke-1 mr-2"
                    />
                    <div class="text-lg font-medium">
                        {{ chapter.title }}
                    </div>
                </DisclosureButton>
                <DisclosurePanel class="px-10 pb-2">
                    <div v-for="lesson in chapter.lessons" :key="lesson.name">
                        <div class="flex items-center text-lg mb-4">
                            <MonitorPlay v-if="lesson.icon === 'icon-youtube'" class="h-4 w-4 text-gray-900 stroke-1 mr-2"/>
                            <HelpCircle v-else-if="lesson.icon === 'icon-quiz'" class="h-4 w-4 text-gray-900 stroke-1 mr-2"/>
                            <FileText v-else-if="lesson.icon === 'icon-list'" class="h-4 w-4 text-gray-900 stroke-1 mr-2"/>
                            {{ lesson.title }}
                        </div>
                    </div>
                </DisclosurePanel>
            </Disclosure>
        </div>
    </div>
</template>
<script setup>
import { createResource } from "frappe-ui";
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronUp, MonitorPlay, HelpCircle, FileText } from 'lucide-vue-next';

const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
});

const outline = createResource({
    url: "lms.lms.utils.get_course_outline",
    cache: ["course_outline", props.courseName],
    params: {
        course: props.courseName
    },
    auto: true,
});
</script>
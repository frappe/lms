<template>
    <div class="text-base">
        <div class="mt-4">
            <Disclosure v-slot="{ open }" v-for="(chapter, index) in outline.data" :key="chapter.name" :defaultOpen="index == 0">
                <DisclosureButton class="flex w-full px-2 pt-2 pb-3">
                    <ChevronRight
                        :class="{'rotate-90 transform duration-200' : open, 'duration-200' : !open, 'open': index == 1}"
                        class="h-5 w-5 text-gray-900 stroke-1 mr-2"
                    />
                    <div class="text-lg font-medium">
                        {{ chapter.title }}
                    </div>
                </DisclosureButton>
                <DisclosurePanel class="px-10 pb-4">
                    <div v-for="lesson in chapter.lessons" :key="lesson.name">
                        <div class="flex items-center text-base mb-3">
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
import { ChevronRight, MonitorPlay, HelpCircle, FileText } from 'lucide-vue-next';

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
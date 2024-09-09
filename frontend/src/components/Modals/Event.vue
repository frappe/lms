<template>
    <Dialog
        v-model="show"
		:options="{
			size: '2xl',
		}">
            <template #body>
                <div class="flex text-base">
                    <div class="flex flex-col w-1/2 p-5">
                        <div class="text-lg font-semibold mb-4">
                            {{ event.title }}
                        </div>
                        
                        <div class="flex flex-col space-y-3">
                            <div class="flex items-center space-x-1">
                                <BookOpen class="h-4 w-4 stroke-1.5" />
                                <span>
                                    {{ event.course_title }}
                                </span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <Calendar class="h-4 w-4 stroke-1.5" />
                                <span>
                                    {{ dayjs(event.date).format("DD MMM YYYY") }}
                                </span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <Clock class="h-4 w-4 stroke-1.5" />
                                <span>
                                    {{ formatTime(event.start_time) }} - {{ formatTime(event.end_time) }}
                                </span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <User class="h-4 w-4 stroke-1.5" />
                                <span>
                                    {{ event.member }}
                                </span>
                            </div>
                        </div>
                        <Button @click="openCallLink(event.venue)" class="mt-auto">
                            <template #prefix>
                                <Video class="h-4 w-4 stroke-1.5" />
                            </template>
                            <span>
                                {{ __("Join Meeting") }}
                            </span>
                        </Button>
                    </div>
                    <div class="flex flex-col space-y-4 border-l w-1/2 p-5">
                        {{ evaluation.rating }}
                        <Rating v-model="evaluation.rating" :label="__('Rating')"/>
                        <FormControl type="select" :options='[{
                            value: "Pending",
                            label: __("Pending")
                        }, {
                            value: "In Progress",
                            label: __("In Progress")
                        }, {
                            value: "Pass",
                            label: __("Pass")
                        }, {
                            value: "Fail",
                            label: __("Fail")
                        }]'
                        v-model="evaluation.status" :label="__('Status')" />
                        <FormControl type="textarea" v-model="evaluation.summary" :label="__('Summary')" />
                        <Button variant="solid" @click="saveEvaluation()">
                            {{ __("Save") }}
                        </Button>
                    </div>
                </div>
            </template>
    </Dialog>
</template>
<script setup>
import { Dialog, Button, FormControl, createResource } from 'frappe-ui';
import { User, Calendar, Clock, Video, BookOpen } from "lucide-vue-next"
import { inject, reactive, watch } from "vue"
import { formatTime, showToast } from "@/utils"
import Rating from "@/components/Controls/Rating.vue"

const show = defineModel()
const dayjs = inject("$dayjs")

const props = defineProps({
    event: {
        type: [Object, null],
        required: true,
    },
});

const evaluation = reactive({
    rating: 0,
    status: "Pending",
    summary: "",
})

const openCallLink = (link) => {
    window.open(link, "_blank")
}

const evaluationResource = createResource({
    url: "lms.lms.api.save_evaluation_details",
    makeParams(values) {
        return {
            member: props.event.member,
            course: props.event.course,
            date: props.event.date,
            start_time: props.event.start_time,
            end_time: props.event.end_time,
            status: evaluation.status,
            rating: evaluation.rating,
            summary: evaluation.summary,
        }
    },
    auto: false
})

const evaluationDetails = createResource({
    url: "frappe.client.get",
    makeParams(values) {
        return {
            doctype: "LMS Certificate Evaluation",
            filters: {
                member: props.event.member,
                course: props.event.course,
            }
        }
    },
    onSuccess(data) {
        for (const key in data) {
            if (key in evaluation)
                evaluation[key] = data[key]
        }
    },
    auto: false
})

const saveEvaluation = () => {
    evaluationResource.submit({}, {
        onSuccess: () => {
            show.value = false
            showToast( __("Success"), __("Evaluation saved successfully"), "check")
        }
    })
}

watch(show, () => {
    if (show.value) {
        evaluation.rating = 0
        evaluation.status = "Pending"
        evaluation.summary = ""
        evaluationDetails.reload()
    }
})
</script>
<template>
    <div v-if="quiz.doc">
        <div v-if="activeQuestion == 0">
            <div class="bg-blue-100 py-2 px-2 mb-4 rounded-md text-sm text-blue-800">
                <div class="leading-relaxed">
                    {{ __("This quiz consists of {0} questions.").format(quiz.doc.questions.length) }}
                </div>
                <div v-if="quiz.doc.passing_percentage" class="leading-relaxed">
                    {{ __("You will have to get {0}% correct answers in order to pass the quiz.").format(quiz.doc.passing_percentage) }}
                </div>
                <div v-if="quiz.doc.max_attempts" class="leading-relaxed">
                    {{ __("You can attempt this quiz {0}.").format(quiz.doc.max_attempts == 1 ? "1 time" : `${quiz.doc.max_attempts} times`) }}
                </div>
                <div v-if="quiz.doc.time" class="leading-relaxed">
                    {{ __("The quiz has a time limit.For each question you will be given { 0} seconds.").format(quiz.doc.time) }}
                </div>
            </div>
            <div class="border text-center p-20 font-semibold text-lg rounded-md">
                <div>
                    {{ quiz.doc.title }}
                </div>
                <Button @click="startQuiz" class="mt-2">
                    <span>
                        {{ __("Start") }}
                    </span>
                </Button>
            </div>
            
        </div>

        <div v-else>
            <div v-for="index in quiz.doc.questions.length">
                <div v-if="index == activeQuestion">
                    {{ questionDetails }}
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { createDocumentResource, Button } from 'frappe-ui';
import { ref, watch, inject } from 'vue';

const user = inject("$user");

const props = defineProps({
    quizName: {
        type: String,
        required: true,
    },
})

const activeQuestion = ref(0);
const currentQuestion = ref("");

const quiz = createDocumentResource({
    doctype: "LMS Quiz",
    name: props.quizName,
    cache: ["quiz", props.quizName],
});
console.log(user.data)
if (user.data) {
    quiz.reload();
}

const questionDetails = createDocumentResource({
    doctype: "LMS Question",
    name: currentQuestion.value,
    cache: ["question", props.quizName, currentQuestion.value],
});
console.log(questionDetails)
const startQuiz = () => {
    activeQuestion.value = 1;
}

watch(activeQuestion, (value) => {
    if (value > 0) {
        currentQuestion.value = quiz.doc.questions[value - 1];
        console.log(currentQuestion.value)
        console.log(questionDetails)
    }
})
</script>
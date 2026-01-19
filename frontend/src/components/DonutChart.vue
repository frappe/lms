<template>
    <div class="flex items-center gap-8 justify-center p-4">
        <!-- CHART -->
        <div class="relative w-[260px] h-[260px]">
            <Doughnut :data="chartData" :options="chartOptions" />

            <!-- CENTER LABEL -->
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div class="text-sm text-gray-500 font-medium">Total</div>
                <div class="text-3xl font-bold text-gray-900">100%</div>
            </div>
        </div>

        <!-- LEGEND -->
        <div class="space-y-3 min-w-[140px]">
            <div v-for="(item, i) in normalizedData" :key="i" class="flex items-center gap-3 text-sm font-medium">
                <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: item.color }"></span>
                <span class="text-gray-900">{{ item.label }}</span>
                <span class="text-gray-500 font-normal">({{ item.percent }}%)</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps({
    data: {
        type: Array,
        default: () => []
    },
    title: {
        type: String,
        default: ''
    }
})

// Specific colors requested: In Progress -> #125CA2, Completed -> #01C295
// We map them by index assuming the order is consistent or we cycle them.
// Given the user example ['#125CA2', '#01C295'], we will use this palette.
const colors = ['#125CA2', '#01C295', '#f59e0b', '#ef4444']

const total = computed(() => props.data.reduce((acc, val) => acc + val.value, 0))

const normalizedData = computed(() => {
    return props.data.map((item, index) => ({
        ...item,
        percent: Math.round((item.value / total.value) * 100),
        color: colors[index % colors.length]
    }))
})

const chartData = computed(() => ({
    labels: props.data.map(d => d.label),
    datasets: [{
        data: props.data.map(d => d.value),
        backgroundColor: normalizedData.value.map(d => d.color),
        borderWidth: 0,
        borderRadius: 8, // Fully rounded ends
        spacing: 5, // Gap between segments
        cutout: '60%' // Thickness
    }]
}))

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false // We use custom legend
        },
        tooltip: {
            backgroundColor: '#111827',
            titleColor: '#fff',
            bodyColor: '#fff',
            bodyFont: {
                family: 'Inter, sans-serif',
                size: 13,
                weight: 'bold'
            },
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            callbacks: {
                label: function (context) {
                    const value = context.parsed;
                    const percentage = Math.round((value / total.value) * 100) + '%';
                    return `${context.label}: ${percentage}`;
                }
            }
        }
    },
    animation: {
        animateScale: true,
        animateRotate: true
    }
}
</script>
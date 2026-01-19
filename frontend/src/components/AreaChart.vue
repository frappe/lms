<template>
    <div class="h-[260px] w-full">
        <Line :data="chartData" :options="chartOptions" />
    </div>
</template>

<script setup>
import { computed } from 'vue'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

const props = defineProps({
    data: {
        type: Array,
        default: () => []
    },
    name: {
        type: String,
        default: ''
    }
})

const chartData = computed(() => {
    return {
        labels: props.data.map(d => d.x),
        datasets: [
            {
                label: props.name,
                data: props.data.map(d => d.y),
                borderColor: '#10b981',
                borderWidth: 3,
                tension: 0.4, // Smooth curve
                fill: true,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx
                    if (!ctx) return 'rgba(16, 185, 129, 0.1)'
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300)
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)')
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.05)')
                    return gradient
                },
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10b981',
                pointBorderWidth: 3
            }
        ]
    }
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            backgroundColor: '#111827',
            titleColor: '#9ca3af',
            bodyColor: '#fff',
            titleFont: {
                family: 'Inter, sans-serif',
                size: 12,
                weight: 'normal'
            },
            bodyFont: {
                family: 'Inter, sans-serif',
                size: 14,
                weight: 'bold'
            },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
                title: function (context) {
                    const date = new Date(context[0].label)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                },
                label: function (context) {
                    return `${context.parsed.y} ${props.name}`
                }
            }
        }
    },
    scales: {
        x: {
            grid: {
                display: false,
                drawBorder: false
            },
            ticks: {
                color: '#6b7280',
                font: {
                    family: 'Inter, sans-serif',
                    size: 12
                },
                maxTicksLimit: 8,
                callback: function (val, index) {
                    // Chart.js passes index as val for category scale often, need to check label
                    const label = this.getLabelForValue(val)
                    const date = new Date(label)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
            },
            border: {
                display: false
            }
        },
        y: {
            alert: false, // not a valid config but sometimes copy-paste artifact. removing.
            grid: {
                color: '#f3f4f6',
                borderDash: [0], // solid lines
                drawBorder: false,
                drawTicks: false
            },
            ticks: {
                color: '#6b7280',
                font: {
                    family: 'Inter, sans-serif',
                    size: 12
                },
                padding: 10
            },
            border: {
                display: false
            },
            beginAtZero: true
        }
    },
    interaction: {
        intersect: false,
        mode: 'index',
    },
}
</script>

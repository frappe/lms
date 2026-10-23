<template>
	<ImportList v-if="hasDataImportWizard && route.name === 'DataImportList'" />
	<WizardImport v-else-if="hasDataImportWizard" />
	<LegacyImport v-else />
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { hasDataImportWizard } from '@/utils/frameworkDataImport'
import ImportList from '@/pages/DataImport/List.vue'
import WizardImport from '@/pages/DataImport/Wizard.vue'
import LegacyImport from '@/pages/DataImport/Legacy.vue'

// The one-page import lists saved imports itself; the wizard has no list.
const route = useRoute()
</script>

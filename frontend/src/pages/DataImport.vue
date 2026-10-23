<template>
	<WizardImport v-if="hasDataImportWizard" />
	<LegacyImport v-else />
</template>
<script setup lang="ts">
import { hasDataImportWizard } from '@/utils/frameworkDataImport'
import WizardImport from '@/pages/DataImport/Wizard.vue'
import LegacyImport from '@/pages/DataImport/Legacy.vue'
</script>

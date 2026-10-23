import type { Component } from 'vue'
import * as kit from '@framework/ui/components/DataImport/index'

/**
 * Frappe's data import, whichever one this bench's frappe ships: the step
 * wizard (version-16 from 16.53.0) or the one-page import before it
 * (version-15 and earlier 16 releases). Each is read by name off the module
 * rather than imported by name, because a named import of the one that is
 * missing fails the whole build.
 */
const exported = <T>(name: string) => (name in kit ? (Reflect.get(kit, name) as T) : undefined)

export const DataImportWizard = exported<Component>('DataImportWizard')
export const useDataImport = exported<(...args: any[]) => any>('useDataImport')
export const LegacyDataImport = exported<Component>('DataImport')

export const hasDataImportWizard = Boolean(DataImportWizard && useDataImport)

<template lang="pug">
  .dito-schema
    .dito-schema-header(
      v-if="label || tabs || clipboard"
      :class="{ 'dito-schema-menu-header': menuHeader }"
    )
      .dito-label(
        v-if="label"
      ) {{ label }}
      dito-tabs(
        v-if="tabs"
        :tabs="tabs"
        :selectedTab="selectedTab"
      )
      dito-clipboard(
        v-if="clipboard"
      )
    dito-components.dito-tab-components(
      v-for="(tabSchema, key) in tabs"
      ref="tabs"
      v-show="selectedTab === key"
      :key="key"
      :tab="key"
      :schema="tabSchema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
      :showPanels="showPanels"
      :generateLabels="generateLabels"
    )
    dito-components.dito-main-components(
      v-if="schema.components"
      ref="components"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
      :showPanels="showPanels"
      :generateLabels="generateLabels"
    )
    slot(name="buttons")
</template>

<style lang="sass">
$tab-height: $menu-font-size + 2 * $tab-padding-ver
.dito
  .dito-schema
    padding: $content-padding
    box-sizing: border-box
    .dito-schema-content
      max-width: $content-width
    // Display a ruler between tabbed components and towards the .dito-buttons
    .dito-tab-components + .dito-main-components,
    .dito-components + .dito-form-buttons
      .dito-schema-content::before
        // Use a pseudo element to display a ruler with proper margins
        display: block
        content: ''
        width: 100%
        padding-top: $content-padding
        border-bottom: $border-style
    .dito-tab-components + .dito-main-components
      .dito-schema-content::before
        // Add removed $form-spacing again to the ruler
        margin: $form-spacing-half
  .dito-schema-header
    display: flex
    box-sizing: border-box
    // turn off pointer events in background so that DitoTrail keeps working.
    pointer-events: none
    justify-content: space-between
    > *
      pointer-events: auto
    .dito-tabs,
    .dito-clipboard
      display: flex
      align-self: flex-end
    .dito-clipboard
      &:only-child
        margin-left: auto
      .dito-button
        margin: 0 0 $tab-margin $tab-margin
    &.dito-schema-menu-header
      position: absolute
      height: $tab-height
      margin-top: -$tab-height
      padding: 0 $menu-padding-hor
      max-width: $content-width + 2 * $content-padding
      top: 0
      left: 0
      right: 0
      z-index: $menu-z-index
      > *
        font-size: $menu-font-size
      .dito-tabs a
        line-height: $menu-line-height
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ValidatorMixin from '@/mixins/ValidatorMixin'
import ItemMixin from '@/mixins/ItemMixin'
import { appendDataPath, getParentItem } from '@/utils/data'
import { setDefaults } from '@/utils/schema'
import {
  isObject, isArray, isFunction, parseDataPath, normalizeDataPath, labelize
} from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-schema', {
  mixins: [ValidatorMixin, ItemMixin],
  inject: ['$validator'],

  provide() {
    return {
      $schemaComponent: this
    }
  },

  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    label: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: true },
    hasOwnData: { type: Boolean, default: false },
    menuHeader: { type: Boolean, default: false }
  },

  data() {
    const { data } = this.schema
    return {
      // Allow schema to provide more data through `schema.data`, vue-style:
      ...(
        data && isFunction(data)
          ? data.call(this)
          : data
      ),
      components: {},
      showPanels: false,
      // Register dataProcessors separate from components, so they can survive
      // their life-cycles and be used at the end in `processData()`.
      dataProcessors: {},
      temporaryId: 0
    }
  },

  computed: {
    schemaComponent() {
      // Override DitoMixin's schemaComponent() which uses the injected value.
      return this
    },

    tabs() {
      return this.schema?.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.tabs && Object.keys(this.tabs)[0] || ''
    },

    clipboard() {
      return this.schema?.clipboard
    },

    clipboardData() {
      return this.processData({
        removeIds: true
      })
    },

    // The following computed properties are similar to the fields returned by
    // getItemParams(), so that we can access these on `this` as well:
    item() {
      // NOTE: While internally, we speak of `data`, in the API surface the
      // term `item` is used for the data that relates to editing objects.
      // NOTE: This should always return the same as:
      // return getItem(this.rootData, this.dataPath, false)
      return this.data
    },

    parentItem() {
      return getParentItem(this.rootData, this.dataPath, false)
    },

    rootItem() {
      return this.rootData
    },

    processedItem() {
      return this.processData({ processIds: true })
    },

    formLabel() {
      return this.getLabel(this.getItemFormSchema(this.sourceSchema, this.data))
    },

    isLoading() {
      return this.someComponent(it => it.isLoading)
    },

    isDirty() {
      return this.someComponent(it => it.isDirty)
    },

    isTouched() {
      return this.someComponent(it => it.isTouched)
    },

    isValid() {
      // Components without validation have `isValid` return undefined.
      // Don't count those as invalid.
      return this.everyComponent(it => it.isValid !== false)
    },

    isValidated() {
      // Components without validation have `isValid` return undefined.
      // Don't count those as not validated.
      return this.everyComponent(it => it.isValidated !== false)
    }
  },

  watch: {
    selectedTab() {
      this.$nextTick(() => this.onLayout())
    }
  },

  created() {
    this.setupSchemaFields()
    // Emit 'layout' events right after creation, and whenever data changes:
    this.on(['change', 'load'], () => this.onLayout())
    this.$nextTick(() => {
      // Trigger a 'layout' event right after creation, unless when loading:
      // Then don't trigger 'layout' yet, wait for 'load' instead, to avoid
      // unnecessary jumping around of panels.
      if (!this.dataRouteComponent?.isLoading) {
        this.onLayout()
      }
    })
    // Delegate change events through to parent schema:
    this.delegate('change', this.parentSchemaComponent)
  },

  mounted() {
    this.showPanels = !!(
      this.$refs.components.hasPanels ||
      this.$refs.tabs?.some(tab => tab.hasPanels)
    )
  },

  methods: {
    registerComponent(dataPath, comp) {
      if (comp) {
        this.$set(this.components, dataPath, comp)
        // Store the `dataProcessor` closure for this dataPath, for processing
        // of the data at later time when the component may not exist anymore:
        this.$set(this.dataProcessors, dataPath, comp.mergedDataProcessor)
      } else {
        this.$delete(this.components, dataPath)
        // NOTE: We don't remove the dataProcessors here! They may still be
        // required after the life-cycle of the component itself, which is
        // why they are constructed to have no reference to their component.
      }
      this.parentSchemaComponent?.registerComponent(dataPath, comp)
    },

    getComponent(dataPathOrKey) {
      const normalizedPath = normalizeDataPath(dataPathOrKey)
      // See if the argument starts with this form's data-path. If not, then it
      // is a key or sub data-path and needs to be prefixed with the full path:
      const dataPath = !normalizedPath.startsWith(this.dataPath)
        ? appendDataPath(this.dataPath, normalizedPath)
        : normalizedPath
      return this.components[dataPath] || null
    },

    findComponent(callback) {
      return Object.values(this.components).find(callback)
    },

    someComponent(callback) {
      return Object.values(this.components).some(callback)
    },

    everyComponent(callback) {
      return Object.values(this.components).every(callback)
    },

    onLoad() {
      this.emitEvent('load')
    },

    onChange() {
      this.emitEvent('change')
    },

    onLayout() {
      this.emitEvent('layout')
    },

    focus(dataPathOrKey, notify = false) {
      this.getComponent(dataPathOrKey)?.focus()
      if (notify) {
        this.notifyErrors()
      }
    },

    showErrors(errors, focus) {
      this.clearErrors()
      let first = true
      const unmatched = []
      for (const [dataPath, errs] of Object.entries(errors)) {
        // If the schema is a data-root, prefix its own dataPath to all errors,
        // since the data that it sends and validate swill be unprefixed.
        const fullDataPath = this.hasOwnData
          ? appendDataPath(this.dataPath, dataPath)
          : dataPath
        // console.log(this, this.dataPath, this.hasOwnData, fullDataPath)
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPathParts = parseDataPath(fullDataPath)
        const component = this.getComponent(dataPathParts)
        if (component) {
          component.addErrors(errs, first && focus)
        } else {
          // Couldn't find a component in an active form for the given dataPath.
          // See if we can find a component serving a part of the dataPath,
          // and take it from there:
          const property = dataPathParts.pop()
          while (dataPathParts.length > 0) {
            const component = this.getComponent(dataPathParts)
            if (component?.navigateToComponent?.(fullDataPath, routeRecord => {
              // Filter the errors to only contain those that belong to the
              // matched dataPath:
              const normalizedPath = normalizeDataPath(dataPathParts)
              // Pass on the errors to the instance through the meta object,
              // see DitoForm.created()
              routeRecord.meta.errors = Object.entries(errors).reduce(
                (filtered, [dataPath, errs]) => {
                  if (normalizeDataPath(dataPath).startsWith(normalizedPath)) {
                    filtered[dataPath] = errs
                  }
                  return filtered
                },
                {}
              )
            })) {
              // We found some nested form to display at least parts fo the
              // errors. We can't display all errors at once, so we're done.
              // Don't call notifyErrors() yet, as we can only display it
              // once showErrors() was called from DitoForm.mounted()
              return
            }
            // Keep removing the last part until we find a match.
            dataPathParts.pop()
          }
          // When the error can't be matched, add it to a list of unmatched
          // errors with decent message, to report at the end.
          const field = labelize(property)
          for (const err of errs) {
            const prefix = field
              ? `The field ${field}`
              : `The ${this.formLabel}`
            unmatched.push(`${prefix} ${err.message}`)
          }
        }
        first = false
      }
      if (!first) {
        this.notifyErrors(unmatched.join('\n'))
      }
    },

    notifyErrors(message) {
      this.notify(
        'error',
        'Validation Errors',
        message || 'Please correct the highlighted errors.'
      )
    },

    resetData() {
      // We can't set `this.data = ...` because it's a property, but we can
      // set all known properties on it to the values returned by
      // `setDefaults()`, as they are all reactive already from the starts:
      Object.assign(this.data, setDefaults(this.schema, {}))
      this.clearErrors()
    },

    filterData(data) {
      // Filters out arrays that aren't considered nested data, as those are
      // already taking care of themselves through their own end-points and
      // shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value)) {
          const component = this.getComponent(key)
          // Only check for isNested on source items that actually load data,
          // since other components can have array values too.
          if (component && component.isSource && !component.isNested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    processData({ processIds = false, removeIds = false } = {}) {
      // @ditojs/server specific handling of relates within graphs:
      // Find entries with temporary ids, and convert them to #id / #ref pairs.
      // Also handle items with relate and convert them to only contain ids.
      const process = (value, name, dataPath) => {
        // First, see if there's an associated component requiring processing.
        // See TypeMixin.mergedDataProcessor(), OptionsMixin.dataProcessor():
        const dataProcessor = this.dataProcessors[dataPath]
        if (dataProcessor) {
          value = dataProcessor(value, name, dataPath, this.rootData)
        }
        // Special handling is required for temporary ids when processing non
        // transient data: Replace id with #id, so '#ref' can be used for
        // relates, see OptionsMixin:
        const isObj = isObject(value)
        if (
          isObj &&
          processIds &&
          !this.isTransient &&
          this.hasTemporaryId(value)
        ) {
          const { id, ...rest } = value
          // A reference is a shallow copy that hold nothing more than ids.
          // Use #ref instead of #id for these:
          value = this.isReference(value)
            ? { '#ref': id }
            : { '#id': id, ...rest }
        }
        if (isObj || isArray(value)) {
          // Use reduce() for both arrays and objects thanks to Object.entries()
          value = Object.entries(value).reduce(
            (processed, [key, val]) => {
              val = process(val, key, appendDataPath(dataPath, key))
              if (val !== undefined) {
                processed[key] = val
              }
              return processed
            },
            isArray(value) ? [] : {}
          )
        }
        if (isObj && removeIds && value.id) {
          delete value.id
        }
        return value
      }
      return process(this.data, null, this.dataPath)
    },

    hasTemporaryId(data) {
      return /^@/.test(data?.id)
    },

    setTemporaryId(data) {
      // Temporary ids are marked with a '@' at the beginning.
      data.id = `@${++this.temporaryId}`
    },

    isReference(data) {
      // Returns true if value is an object that holds nothing more than an id.
      const keys = data && Object.keys(data)
      return keys?.length === 1 && keys[0] === 'id'
    }
  }
})
</script>

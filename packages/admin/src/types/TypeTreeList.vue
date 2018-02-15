<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :data="{ [name]: value }"
        :schema="{ [name]: schema }"
        :open="true"
        :container="this"
      )
      router-view
</template>

<style lang="sass">
.dito
  .dito-tree-list
    .dito-tree-panel
      display: flex
      > .dito-tree-item
        flex: 0 1 auto
      > .dito-form
        margin-left: $form-margin
        width: 0 // let it grow to size
        flex: 1 1 auto
        align-self: flex-start
        .dito-content
          padding: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import ListMixin from '@/mixins/ListMixin'
import { isObject } from '@ditojs/utils'

export default TypeComponent.register('tree-list', {
  mixins: [ListMixin],

  computed: {
    path() {
      // Accessed from DitoTreeItem through `container.path`:
      return this.formComponent?.path
    },

    editPath() {
      // Accessed from DitoTreeItem through `container.editPath`:
      return this.$route.path.substring(this.path?.length)
    }
  },

  processSchema
})

async function processSchema(listSchema, name, api, routes, parentMeta, level,
  nested = true, flatten = false) {
  return ListMixin.processSchema(
    listSchema, name, api, routes, parentMeta, level, nested, flatten,
    // Pass processSchema() to add more routes to childRoutes:
    (childRoutes, parentMeta, level) => {
      const promises = []
      for (const [name, schema] of Object.entries(listSchema)) {
        if (name !== 'form' && isObject(schema)) {
          promises.push(
            processSchema(
              schema, name, api, childRoutes, parentMeta, level, nested, true)
          )
        }
      }
      return Promise.all(promises)
    })
}
</script>
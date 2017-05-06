export default {
  computed: {
    // Short-cuts to meta properties:
    viewDesc() { return this.meta.viewDesc },
    formDesc() { return this.viewDesc.formDesc },
    user() { return this.meta.user },
    api() { return this.meta.api },

    routeComponent() {
      // Loop through all non-route components (e.g. DitoPanel, DitoTab) until
      // the closest component that is in the route is found.
      let comp = this
      while (comp && !comp.isRoute) {
        comp = comp.$parent
      }
      return comp
    },

    parentRouteComponent() {
      return this.$parent.routeComponent
    },

    formComponent() {
      let comp = this.routeComponent
      return comp && comp.isForm ? comp : null
    },

    parentFormComponent() {
      return this.$parent.formComponent
    }
  }
}
import { QueryError } from '@/errors'
import { capitalize } from '@/utils'

// TODO:
// Make this work with objection.ref():
// https://github.com/Vincit/objection.js/blob/master/doc/includes/API.md#global-query-building-helpers
// So that query references can works with JSON attributes as well. See if this
// also works with eager query data, nested relationships, etc?
// TODO: semi-colon is currently used for operators. Use a different string
// to mark operators instead, e.g. 'jsonColumn:details.name::like=%bla%'
// TODO: Implement proper OR queries through where objects rather than the
// current '|' approach that only works with one operator for multiple fields.
// See: https://flask-restless.readthedocs.io/en/stable/searchformat.html
export default class PropertyRef {
  constructor(str, modelClass, parseDir, checkAllow) {
    if (parseDir) {
      // Support direction for order statements
      const [key, dir] = str.trim().split(/\s+/)
      if (dir && !/^(asc|desc)$/i.test(dir)) {
        throw new QueryError(`PropertyRef: Invalid order direction: ${dir}`)
      }
      this.key = key
      this.dir = dir
    } else {
      this.key = str.trim()
    }
    if (checkAllow && !checkAllow[this.key]) {
      throw new QueryError(
        `PropertyRef: Property reference "${this.key}" not allowed`)
    }
    const parts = this.key.split('.')
    if (parts.length === 1) {
      this.relation = null
      this.propertyName = parts[0]
      this.modelClass = modelClass
    } else if (parts.length === 2) {
      const relationName = parts[0]
      try {
        this.relation = modelClass.getRelation(relationName)
      } catch (err) {
        throw new QueryError(
          `PropertyRef: Unknown relation "${relationName}"`)
      }
      this.propertyName = parts[1]
      this.modelClass = this.relation.relatedModelClass
    } else {
      throw new QueryError(
        `PropertyRef: Only one level of relations is supported`)
    }
    this.columnName = this.modelClass.propertyNameToColumnName(
      this.propertyName)
    if (!this.columnName) {
      throw new QueryError(`PropertyRef: Unknown property "${this.key}"`)
    }
  }

  fullColumnName(builder) {
    const tableRef = builder.tableRefFor(this.modelClass)
    return `${tableRef}.${this.columnName}`
  }

  applyFilter(builder, query, filter, value, boolOp) {
    const { method, args } = filter(builder, this, value, this.modelClass)
    const whereMethod = boolOp ? `${boolOp}${capitalize(method)}` : method
    const { relation } = this
    // TODO: Figure out all relations
    if (relation /* && !relation.isOneToOne() */) {
      const subQuery = relation.findQuery(relation.relatedModelClass.query(), {
        ownerIds: relation.ownerProp.refs(builder)
      })
      subQuery[whereMethod](...args)
      query.whereExists(subQuery)
    } else {
      query[whereMethod](...args)
    }
  }
}
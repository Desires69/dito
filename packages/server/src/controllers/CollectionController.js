import objection from 'objection'
import { NotFoundError } from '@/errors'
import { Controller } from './Controller'

export class CollectionController extends Controller {
  constructor(app, namespace) {
    super(app, namespace)
    this.isOneToOne = false
  }

  initialize(isRoot) {
    super.initialize(isRoot)
    this.idParam = this.level ? `id${this.level}` : 'id'
    this.graph = !!this.graph
    this.scope = this.scope || null
    this.applyScope = this.scope
      ? query => query.applyScope(this.scope)
      : null
    this.collection = this.setupActions('collection')
    this.member = this.isOneToOne ? {} : this.setupActions('member')
  }

  // @override
  setupAction(action, name, actions) {
    const isMember = actions === this.member
    let verb = actionToVerb[name]
    let path = ''
    let handler = action
    if (!verb) {
      // A custom action:
      verb = action.verb || 'get'
      path = action.path || this.app.normalizePath(name)
      handler = ctx => this.callAction(action, ctx,
        isMember && (ctx => actions.find.call(this, ctx))
      )
    }
    this.setupRoute(verb, this.getPath(isMember, path), handler)
  }

  getPath(isMember, path) {
    return isMember
      ? path ? `:${this.idParam}/${path}` : `:${this.idParam}`
      : path
  }

  checkModel(model, id) {
    if (!model) {
      throw new NotFoundError(
        `Cannot find '${this.modelClass.name}' model with id ${id}`)
    }
    return model
  }

  getId(ctx) {
    const id = ctx.params[this.idParam]
    const { name } = this.modelClass
    // Use a cached dummy instance to validate the format of the passed id.
    const validator = validatorsCache[name] ||
      // eslint-disable-next-line new-cap
      (validatorsCache[name] = new this.modelClass())
    validator.$validate(
      this.modelClass.getIdProperties(id),
      { patch: true }
    )
    return id
  }

  executeQuery(transaction, ctx, modify) {
    // NOTE: ctx is required by RelationController which overrides executeQuery.
    const call = modelClass => modify(
      modelClass.query().modify(this.applyScope)
    )
    return transaction
      ? objection.transaction(this.modelClass, call)
      : call(this.modelClass)
  }

  executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.executeQuery(this.graph, ctx, query =>
      query[name](ctx.request.body)
        .modify(modify)
    )
  }

  executeAndFetchById(action, ctx, modify) {
    const id = this.getId(ctx)
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.executeQuery(this.graph, ctx, query =>
      query[name](id, ctx.request.body)
        .modify(modify)
        .then(model => this.checkModel(model, id))
    )
  }

  collection = {
    find(ctx, modify) {
      const find = this.isOneToOne ? 'findOne' : 'find'
      return this.executeQuery(false, ctx, query => query
        .modify(modify)[find](ctx.request.body)
      )
    },

    delete(ctx, modify) {
      // TODO: Decide if we should set status? status = 204
      return this.executeQuery(false, ctx, query => query
        .modify(modify)
        // TODO: Test if filter works for delete
        .find(ctx.query)
        .delete()
        .then(count => ({ count }))
      )
    },

    insert(ctx, modify) {
      // TODO: Decide if we should set status? status = 201
      return this.executeAndFetch('insert', ctx, modify)
    },

    update(ctx, modify) {
      return this.executeAndFetch('update', ctx, modify)
    },

    patch(ctx, modify) {
      return this.executeAndFetch('patch', ctx, modify)
    }
  }

  member = {
    find(ctx, modify) {
      const id = this.getId(ctx)
      return this.executeQuery(false, ctx, query => query
        .modify(modify)
        .findById(id, ctx.query)
        .then(model => this.checkModel(model, id))
      )
    },

    delete(ctx, modify) {
      const id = this.getId(ctx)
      return this.executeQuery(false, ctx, query => query
        .modify(modify)
        .deleteById(id)
        .then(count => ({ count }))
      )
    },

    update(ctx, modify) {
      return this.executeAndFetchById('update', ctx, modify)
    },

    patch(ctx, modify) {
      return this.executeAndFetchById('patch', ctx, modify)
    }
  }
}

const actionToVerb = {
  find: 'get',
  delete: 'delete',
  insert: 'post',
  update: 'put',
  patch: 'patch'
}

const validatorsCache = {}

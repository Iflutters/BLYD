/**
 * Acesso a espaços e páginas de documentação (compartilhado pelos serviços de espaços e páginas).
 * Recurso invisível responde "não encontrado" (anti-IDOR), nunca 403.
 */

const { appError } = require('../core/errors')
const rbac = require('../domain/rbac')
const projectDomain = require('../domain/project')
const docsDomain = require('../domain/docs')

function createDocAccess(deps) {
  function projectAccessFor(ctx, space) {
    if (!space.projectId) return null
    const project = deps.projectRepository.findById(space.projectId)
    if (!project) return { canView: false }
    return projectDomain.resolveAccess(ctx.principal, project, deps.projectMemberRepository.find(project.id, ctx.principal.userId))
  }

  function accessOf(ctx, space) {
    return docsDomain.spaceAccess(ctx.principal, space, projectAccessFor(ctx, space))
  }

  function checked(ctx, space) {
    if (!space) throw appError('DOC_SPACE_NOT_FOUND')
    const access = accessOf(ctx, space)
    if (!access.canRead) throw appError('DOC_SPACE_NOT_FOUND')
    return { space, access }
  }

  function loadSpace(ctx, id) {
    rbac.assertAuthenticated(ctx.principal)
    return checked(ctx, id ? deps.docSpaceRepository.findById(id) : null)
  }

  function loadSpaceByKey(ctx, key) {
    rbac.assertAuthenticated(ctx.principal)
    return checked(ctx, typeof key === 'string' && key ? deps.docSpaceRepository.findByKey(key) : null)
  }

  function loadPage(ctx, id) {
    rbac.assertAuthenticated(ctx.principal)
    const page = id ? deps.docPageRepository.findById(id) : null
    const space = page ? deps.docSpaceRepository.findById(page.spaceId) : null
    if (!page || !space) throw appError('DOC_PAGE_NOT_FOUND')
    const access = accessOf(ctx, space)
    if (!docsDomain.canSeePage(access, page)) throw appError('DOC_PAGE_NOT_FOUND')
    return { page, space, access }
  }

  /** Espaços que a pessoa lê (com o acesso de cada um). */
  function readableSpaces(ctx) {
    rbac.assertAuthenticated(ctx.principal)
    if (!rbac.can(ctx.principal, 'docs.view')) return []
    return deps.docSpaceRepository
      .list()
      .map((space) => ({ space, access: accessOf(ctx, space) }))
      .filter((item) => item.access.canRead)
  }

  return { accessOf, loadSpace, loadSpaceByKey, loadPage, readableSpaces }
}

module.exports = { createDocAccess }

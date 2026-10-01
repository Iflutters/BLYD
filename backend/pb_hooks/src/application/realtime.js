/**
 * Casos de uso do tempo real (regras de negócio §19): autorizar as assinaturas de uma conexão e
 * transformar uma mudança gravada no aviso para o tópico certo.
 *
 * As assinaturas valem pela regra de visibilidade do projeto (membro, dono ou `projects.view_all`, com
 * `projects.view`) e o tópico da própria pessoa; o resto é descartado em silêncio (a conexão continua).
 */

const rbac = require('../domain/rbac')
const projectDomain = require('../domain/project')
const realtimeDomain = require('../domain/realtime')

function createRealtimeService(deps) {
  function canViewProject(principal, projectId) {
    const project = deps.projectRepository.findById(projectId)
    if (!project) return false
    const membership = deps.projectMemberRepository.find(project.id, principal.userId)
    return projectDomain.resolveAccess(principal, project, membership).canView
  }

  /** Tópicos pedidos → { allowed, rejected }; sem sessão → UNAUTHENTICATED. */
  function authorize(ctx, topics) {
    rbac.assertAuthenticated(ctx.principal)
    const allowed = []
    const rejected = []
    realtimeDomain.normalizeTopics(topics).forEach((topic) => {
      const parsed = realtimeDomain.parseTopic(topic)
      const ok = !!parsed && (parsed.kind === 'user' ? parsed.id === ctx.principal.userId : canViewProject(ctx.principal, parsed.id))
      ;(ok ? allowed : rejected).push(topic)
    })
    return { allowed, rejected }
  }

  /**
   * Mudança gravada → { topic, payload } ou null. `change`: { collection, action, id, projectId?,
   * taskId?, itemId?, userId? } — sem projeto, ele vem da tarefa (comentários, anexos, relações).
   */
  function eventFor(change) {
    let projectId = change.projectId || null
    if (!projectId && change.taskId) {
      const task = deps.taskRepository.findById(change.taskId)
      projectId = task ? task.projectId : null
    }
    return realtimeDomain.buildEvent(Object.assign({}, change, { projectId }))
  }

  return { authorize, eventFor }
}

module.exports = { createRealtimeService }

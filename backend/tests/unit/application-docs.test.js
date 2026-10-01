const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createDocSpaceService } = require('../../pb_hooks/src/application/doc-spaces')
const { createDocPageService } = require('../../pb_hooks/src/application/doc-pages')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')

function ctxOf(deps, user) {
  const role = deps.roleRepository.findById(user.roleId)
  return {
    principal: createPrincipal({ userId: user.id, roleId: role.id, roleCode: role.code, permissions: deps.roleRepository.getPermissionCodes(role.id) }),
    ip: '1.1.1.1',
    userAgent: 'ua',
    correlationId: 'c',
  }
}

function codeOf(fn) {
  try {
    fn()
  } catch (err) {
    return err.code === 'VALIDATION_ERROR' ? `${err.code}:${JSON.stringify(err.details.fields)}` : err.code
  }
  return 'OK'
}

const text = (value) => ({ type: 'text', text: value })
const doc = (...paragraphs) => ({ type: 'doc', content: paragraphs.map((p) => ({ type: 'paragraph', content: [text(p)] })) })
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function setup() {
  const deps = createFakeDeps()
  const gabi = seedUser(deps, { roleCode: 'MANAGER', name: 'Gabi' })
  const mario = seedUser(deps, { roleCode: 'MEMBER', name: 'Mário' })
  const lia = seedUser(deps, { roleCode: 'VIEWER', name: 'Lia' })
  const otto = seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' })
  const project = deps.projectRepository.create({ name: 'CRM', key: 'CRM', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  ;[
    [gabi, 'manager'],
    [mario, 'member'],
    [lia, 'viewer'],
  ].forEach(([u, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: u.id, role }))
  const ctx = { gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), lia: ctxOf(deps, lia), otto: ctxOf(deps, otto) }
  return { deps, ctx, project, spaces: createDocSpaceService(deps), pages: createDocPageService(deps) }
}

describe('application/doc-spaces', () => {
  it('gestor cria espaço da empresa com página inicial publicada; membro não cria', () => {
    const s = setup()
    const space = s.spaces.createSpace(s.ctx.gabi, { key: 'MANUAL', name: 'Manuais', description: 'Guias de uso', icon: 'book', color: 'blue', visibility: 'company' })
    assert.equal(space.key, 'MANUAL')
    assert.ok(space.home_page_id)
    const home = s.pages.getPage(s.ctx.otto, space.home_page_id)
    assert.deepEqual([home.title, home.status, home.version], ['Manuais', 'published', 1])
    assert.equal(codeOf(() => s.spaces.createSpace(s.ctx.mario, { key: 'OUTRO', name: 'Outro', visibility: 'company' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.spaces.createSpace(s.ctx.gabi, { key: 'MANUAL', name: 'Repetido', visibility: 'company' })), 'DOC_SPACE_KEY_IN_USE')
    assert.equal(codeOf(() => s.spaces.createSpace(s.ctx.gabi, { key: 'manual', name: 'X', visibility: 'company' })), 'VALIDATION_ERROR:{"key":"invalid_format"}')
    // qualquer pessoa com docs.view lê espaço da empresa
    assert.deepEqual(s.spaces.listSpaces(s.ctx.otto).map((x) => x.key), ['MANUAL'])
    const audit = s.deps.store.audit.find((e) => e.action === 'doc_space.created')
    assert.equal(audit.entityType, 'doc_space')
  })

  it('espaço só do projeto: fora do projeto não enxerga; leitor lê; membro edita; só gestor configura', () => {
    const s = setup()
    const space = s.spaces.createSpace(s.ctx.gabi, { key: 'CRMDOC', name: 'Docs do CRM', project_id: s.project.id, visibility: 'project' })
    assert.deepEqual(s.spaces.listSpaces(s.ctx.otto), [])
    assert.equal(codeOf(() => s.spaces.getSpace(s.ctx.otto, 'CRMDOC')), 'DOC_SPACE_NOT_FOUND')
    assert.deepEqual(s.spaces.getSpace(s.ctx.lia, 'CRMDOC').capabilities, { edit: false, manage: false })
    assert.deepEqual(s.spaces.getSpace(s.ctx.mario, 'CRMDOC').capabilities, { edit: true, manage: false })
    assert.equal(codeOf(() => s.spaces.updateSpace(s.ctx.mario, space.id, { name: 'X' })), 'FORBIDDEN')
    const updated = s.spaces.updateSpace(s.ctx.gabi, space.id, { name: 'Documentação do CRM', visibility: 'company' })
    assert.equal(updated.visibility, 'company')
    assert.deepEqual(s.spaces.listSpaces(s.ctx.otto).map((x) => x.key), ['CRMDOC'])
    assert.equal(codeOf(() => s.spaces.createSpace(s.ctx.gabi, { key: 'SEMPROJ', name: 'X', visibility: 'project' })), 'VALIDATION_ERROR:{"visibility":"project_required"}')
  })
})

describe('application/doc-pages', () => {
  function withSpace() {
    const s = setup()
    const space = s.spaces.createSpace(s.ctx.gabi, { key: 'MANUAL', name: 'Manuais', visibility: 'company' })
    return Object.assign(s, { space })
  }

  it('página nova é rascunho (só quem edita vê); publicar cria a versão 1; rascunho novo não aparece até publicar', () => {
    const s = withSpace()
    const page = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'Agenda', parent_id: null })
    assert.equal(page.status, 'draft')
    assert.ok(!s.spaces.getSpace(s.ctx.lia, 'MANUAL').pages.some((p) => p.id === page.id))
    assert.ok(s.spaces.getSpace(s.ctx.mario, 'MANUAL').pages.some((p) => p.id === page.id))
    assert.equal(codeOf(() => s.pages.getPage(s.ctx.lia, page.id)), 'DOC_PAGE_NOT_FOUND')

    s.pages.saveDraft(s.ctx.mario, page.id, { title: 'Agenda', content: doc('Será visualizado a agenda por dia.') })
    const published = s.pages.publishPage(s.ctx.mario, page.id, {})
    assert.deepEqual([published.status, published.version], ['published', 1])
    assert.match(JSON.stringify(s.pages.getPage(s.ctx.lia, page.id).content), /agenda por dia/)

    // editar de novo: o leitor continua vendo a versão publicada
    s.pages.saveDraft(s.ctx.mario, page.id, { title: 'Agenda (revisada)', content: doc('Nova regra de semana.') })
    const reader = s.pages.getPage(s.ctx.lia, page.id)
    assert.equal(reader.title, 'Agenda')
    assert.equal(reader.draft, null)
    const editor = s.pages.getPage(s.ctx.mario, page.id)
    assert.equal(editor.draft.by.name, 'Mário')
    assert.equal(s.pages.getDraft(s.ctx.mario, page.id).title, 'Agenda (revisada)')
    const v2 = s.pages.publishPage(s.ctx.mario, page.id, {})
    assert.deepEqual([v2.version, v2.title], [2, 'Agenda (revisada)'])
    assert.equal(s.pages.getPage(s.ctx.mario, page.id).draft, null)
    const actions = s.deps.store.audit.filter((e) => e.entityId === page.id).map((e) => e.action)
    assert.deepEqual(actions, ['doc_page.created', 'doc_page.published', 'doc_page.published'])
  })

  it('conteúdo é higienizado ao salvar; leitor não edita', () => {
    const s = withSpace()
    const page = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'Links' })
    const bad = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    s.pages.saveDraft(s.ctx.mario, page.id, { title: 'Links', content: bad })
    assert.equal(s.pages.getDraft(s.ctx.mario, page.id).content.content[0].content[0].marks, undefined)
    assert.equal(codeOf(() => s.pages.saveDraft(s.ctx.mario, page.id, { title: 'X', content: { type: 'script' } })), 'VALIDATION_ERROR:{"content":"invalid_content"}')
    assert.equal(codeOf(() => s.pages.saveDraft(s.ctx.mario, page.id, { title: '', content: null })), 'VALIDATION_ERROR:{"title":"required"}')
    assert.equal(codeOf(() => s.pages.createPage(s.ctx.lia, s.space.id, { title: 'X' })), 'FORBIDDEN')
  })

  it('versões: lista, abre uma antiga e restaura (vira a próxima versão)', () => {
    const s = withSpace()
    const page = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'Regras' })
    s.pages.publishPage(s.ctx.mario, page.id, { title: 'Regras', content: doc('Versão um') })
    s.pages.publishPage(s.ctx.mario, page.id, { title: 'Regras', content: doc('Versão dois') })
    assert.deepEqual(s.pages.listVersions(s.ctx.lia, page.id).map((v) => v.version), [2, 1])
    assert.match(JSON.stringify(s.pages.getVersion(s.ctx.lia, page.id, 1).content), /Versão um/)
    const restored = s.pages.restoreVersion(s.ctx.mario, page.id, 1)
    assert.equal(restored.version, 3)
    assert.match(JSON.stringify(restored.content), /Versão um/)
    assert.equal(codeOf(() => s.pages.getVersion(s.ctx.lia, page.id, 9)), 'DOC_VERSION_NOT_FOUND')
    assert.ok(s.deps.store.audit.some((e) => e.action === 'doc_page.restored' && e.newValue.from_version === 1))
  })

  it('árvore: subpáginas, mover sem ciclo, ordem entre irmãs; excluir leva as subpáginas; a inicial não sai', () => {
    const s = withSpace()
    const a = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'A' })
    const b = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'B', parent_id: a.id })
    const c = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'C', parent_id: b.id })
    const d = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'D' })
    assert.equal(codeOf(() => s.pages.movePage(s.ctx.mario, a.id, { parent_id: c.id })), 'DOC_PAGE_CYCLE')
    // D antes de A, na raiz
    s.pages.movePage(s.ctx.mario, d.id, { parent_id: null, next_id: a.id })
    const roots = s.spaces
      .getSpace(s.ctx.mario, 'MANUAL')
      .pages.filter((p) => !p.parent_id && !p.is_home)
      .map((p) => p.title)
    assert.deepEqual(roots, ['D', 'A'])
    // C sobe para dentro de D
    const moved = s.pages.movePage(s.ctx.mario, c.id, { parent_id: d.id })
    assert.equal(moved.parent_id, d.id)
    assert.deepEqual(s.pages.getPage(s.ctx.mario, c.id).ancestors.map((x) => x.title), ['D'])
    assert.equal(s.pages.deletePage(s.ctx.mario, a.id).deleted, 2)
    assert.equal(codeOf(() => s.pages.getPage(s.ctx.mario, b.id)), 'DOC_PAGE_NOT_FOUND')
    assert.equal(codeOf(() => s.pages.deletePage(s.ctx.gabi, s.space.home_page_id)), 'DOC_PAGE_IS_HOME')
  })

  it('busca sem acento, só no publicado e nos espaços visíveis; recentes', () => {
    const s = withSpace()
    const page = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'Parceiros' })
    s.pages.publishPage(s.ctx.mario, page.id, { title: 'Parceiros', content: doc('O cadastro exige a validação do CNPJ antes de salvar.') })
    const draftOnly = s.pages.createPage(s.ctx.mario, s.space.id, { title: 'Rascunho secreto' })
    s.pages.saveDraft(s.ctx.mario, draftOnly.id, { title: 'Rascunho secreto', content: doc('validacao interna') })
    const results = s.pages.search(s.ctx.otto, { q: 'VALIDACAO' })
    assert.deepEqual(results.map((r) => r.title), ['Parceiros'])
    assert.match(results[0].snippet, /validação do CNPJ/)
    assert.equal(results[0].space.key, 'MANUAL')
    // título também conta
    assert.deepEqual(s.pages.search(s.ctx.otto, { q: 'parcei' }).map((r) => r.title), ['Parceiros'])
    assert.equal(codeOf(() => s.pages.search(s.ctx.otto, { q: 'a' })), 'VALIDATION_ERROR:{"q":"too_short"}')
    assert.ok(s.pages.recent(s.ctx.otto).some((r) => r.title === 'Parceiros'))
  })

  it('arquivos da página: imagem validada pelo conteúdo; quem lê baixa; de fora não', () => {
    const s = setup()
    const space = s.spaces.createSpace(s.ctx.gabi, { key: 'CRMDOC', name: 'Docs do CRM', project_id: s.project.id, visibility: 'project' })
    const page = s.pages.createPage(s.ctx.mario, space.id, { title: 'Tela' })
    const [file] = s.pages.uploadFiles(s.ctx.mario, page.id, [{ name: 'tela.png', size: 1200, head: PNG, handle: {} }])
    assert.equal(file.kind, 'image')
    assert.equal(file.url, `/api/v1/docs/files/${file.id}`)
    assert.equal(codeOf(() => s.pages.uploadFiles(s.ctx.mario, page.id, [{ name: 'tela.png', size: 10, head: [0x3c, 0x68], handle: {} }])), 'VALIDATION_ERROR:{"files":"type_mismatch"}')
    // rascunho: leitor ainda não baixa; depois de publicar, sim
    assert.equal(codeOf(() => s.pages.fileFor(s.ctx.lia, file.id)), 'DOC_FILE_NOT_FOUND')
    s.pages.publishPage(s.ctx.mario, page.id, { title: 'Tela', content: { type: 'doc', content: [{ type: 'image', attrs: { src: file.url } }] } })
    assert.equal(s.pages.fileFor(s.ctx.lia, file.id).id, file.id)
    assert.equal(codeOf(() => s.pages.fileFor(s.ctx.otto, file.id)), 'DOC_FILE_NOT_FOUND')
  })
})

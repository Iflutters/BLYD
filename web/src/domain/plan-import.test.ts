import { describe, expect, it } from 'vitest'
import { buildImport, guessMapping, importTemplate, parseCsv, parseImportDate, parseImportNumber, IMPORT_FIELDS, type ImportField } from './plan-import'

describe('plan-import — leitura da planilha', () => {
  it('CSV com ";" (Excel pt-BR), aspas, "" escapado, CRLF, BOM e linhas vazias', () => {
    const csv = '\uFEFFGrupo;Elemento;Recursos\r\n1.0 Iniciação;"Reunião; kickoff";"Cliente, GP"\r\n\r\nIniciação;"Diz ""oi""";\r\n'
    expect(parseCsv(csv)).toEqual([
      ['Grupo', 'Elemento', 'Recursos'],
      ['1.0 Iniciação', 'Reunião; kickoff', 'Cliente, GP'],
      ['Iniciação', 'Diz "oi"', ''],
    ])
    expect(parseCsv('group,name\nA,B')).toEqual([
      ['group', 'name'],
      ['A', 'B'],
    ])
  })

  it('reconhece as colunas nos três idiomas (sem acento/maiúsculas); repetida é ignorada', () => {
    expect(guessMapping(['Grupo', 'ELEMENTO', 'Subelemento', 'Início', 'Término', 'Esforço estimado', 'Duração', 'Progresso', 'Qualquer', 'Grupo'])).toEqual([
      'group',
      'name',
      'subitem',
      'startDate',
      'endDate',
      'estimatedHours',
      'durationDays',
      'progress',
      null,
      null,
    ])
    expect(guessMapping(['Group', 'Item', 'Status', 'Resources', 'Work (h)', 'Actual (h)'])).toEqual(['group', 'name', 'status', 'resources', 'estimatedHours', 'actualHours'])
    expect(guessMapping(['Fase', 'Nombre', 'Estado', 'Fecha de inicio', 'Progreso'])).toEqual(['group', 'name', 'status', 'startDate', 'progress'])
  })

  it('datas no formato do idioma ou ISO; números com vírgula, unidade e %', () => {
    expect(parseImportDate('26/01/2026', 'pt-BR')).toEqual({ ok: true, value: '2026-01-26' })
    expect(parseImportDate('01/26/2026', 'en')).toEqual({ ok: true, value: '2026-01-26' })
    expect(parseImportDate('2026-1-5', 'es')).toEqual({ ok: true, value: '2026-01-05' })
    expect(parseImportDate('31/02/2026', 'pt-BR').ok).toBe(false)
    expect(parseImportDate('amanhã', 'pt-BR').ok).toBe(false)
    expect(parseImportDate('', 'pt-BR')).toEqual({ ok: true, value: null })
    expect(parseImportNumber('1,5')).toEqual({ ok: true, value: 1.5 })
    expect(parseImportNumber('2 h')).toEqual({ ok: true, value: 2 })
    expect(parseImportNumber('3 dias')).toEqual({ ok: true, value: 3 })
    expect(parseImportNumber('50%')).toEqual({ ok: true, value: 50 })
    expect(parseImportNumber('muito').ok).toBe(false)
  })
})

describe('plan-import — linhas', () => {
  it('elemento e subelemento (coluna Subelemento), recursos separados, problemas por linha', () => {
    const table = [
      ['Grupo', 'Elemento', 'Subelemento', 'Status', 'Início', 'Fim', 'Recursos', 'Esforço estimado', 'Progresso'],
      ['Iniciação', 'Kickoff', '', 'Feito', '26/01/2026', '27/01/2026', 'Cliente; GP', '1,5', ''],
      ['Iniciação', 'Kickoff', 'Pauta', '', '', '', '', '2', '50%'],
      ['', 'Sem grupo', '', '', '99/99/2026', '', '', 'x', ''],
    ]
    const preview = buildImport(table, guessMapping(table[0] ?? []), 'pt-BR')
    expect(preview.missing).toEqual([])
    expect(preview.rows[0]).toEqual({
      line: 2,
      row: { group: 'Iniciação', name: 'Kickoff', parent: null, status: 'Feito', startDate: '2026-01-26', endDate: '2026-01-27', resources: ['Cliente', 'GP'], estimatedHours: 1.5, actualHours: null, durationDays: null, progress: null },
      issues: {},
    })
    expect(preview.rows[1]?.row).toMatchObject({ name: 'Pauta', parent: 'Kickoff', estimatedHours: 2, progress: 50 })
    expect(preview.rows[2]?.issues).toEqual({ startDate: 'invalid_date', estimatedHours: 'invalid_number', group: 'required' })
  })

  it('sem as colunas obrigatórias, avisa quais faltam', () => {
    expect(buildImport([['Status'], ['Feito']], ['status'], 'pt-BR').missing).toEqual(['group', 'name'])
  })

  it('modelo: cabeçalho no idioma, separador do Excel do idioma, com BOM', () => {
    const headers = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, f.toUpperCase()])) as Record<ImportField, string>
    const pt = importTemplate(headers, [{ group: '1.0 Iniciação', name: 'Kickoff; geral' }], 'pt-BR')
    expect(pt.startsWith('\uFEFFGROUP;NAME;')).toBe(true)
    expect(pt).toContain('1.0 Iniciação;"Kickoff; geral";')
    expect(importTemplate(headers, [], 'en').startsWith('\uFEFFGROUP,NAME,')).toBe(true)
  })
})

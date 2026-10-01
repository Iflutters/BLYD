/**
 * Importar elementos para o quadro (GP-2): leitura da planilha CSV no navegador, reconhecimento das
 * colunas (pt-BR, en, es) e conversão das linhas. Formato: uma linha por elemento; linha com
 * **Subelemento** preenchido é subelemento do **Elemento** da mesma linha. Grupo, status e recursos
 * vão pelo nome (o servidor usa os existentes e cria os que faltam, conforme a permissão) e valida
 * de novo tudo (tudo ou nada).
 */
import type { PlanImportRow } from './plan'

export const IMPORT_FIELDS = ['group', 'name', 'subitem', 'status', 'startDate', 'endDate', 'resources', 'estimatedHours', 'actualHours', 'durationDays', 'progress'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Colunas sem as quais não dá para importar. */
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ['group', 'name']

export const MAX_IMPORT_ROWS = 500

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Nomes de coluna aceitos (sem acento/maiúsculas). */
const ALIASES: Record<ImportField, string[]> = {
  group: ['grupo', 'group', 'fase', 'phase', 'grupo/fase'],
  name: ['elemento', 'element', 'item', 'nome', 'name', 'nombre', 'atividade', 'actividad', 'activity'],
  subitem: ['subelemento', 'subitem', 'sub-item', 'subelement', 'sub-elemento'],
  status: ['status', 'estado', 'situacao'],
  startDate: ['inicio', 'start', 'start date', 'data de inicio', 'fecha de inicio', 'comienzo'],
  endDate: ['fim', 'termino', 'end', 'end date', 'data de fim', 'data final', 'fecha de fin', 'fin'],
  resources: ['recursos', 'recurso', 'resources', 'resource'],
  estimatedHours: ['esforco estimado', 'esforco', 'estimated effort', 'effort', 'esfuerzo estimado', 'esfuerzo', 'trabalho (h)', 'trabalho', 'work (h)', 'work', 'trabajo (h)', 'trabajo', 'horas', 'hours'],
  actualHours: ['realizado (h)', 'realizado', 'actual (h)', 'actual', 'horas realizadas'],
  durationDays: ['duracao', 'duracion', 'duration', 'duracao (dias)', 'dias', 'days'],
  progress: ['progresso', 'progress', 'progreso', '%'],
}

/** Campo reconhecido pelo nome da coluna (null = ignorar). */
export function guessField(header: string): ImportField | null {
  const key = fold(header)
  if (!key) return null
  const found = IMPORT_FIELDS.find((field) => ALIASES[field].includes(key))
  return found ?? null
}

/** Um campo por coluna, na ordem; se dois cabeçalhos casam o mesmo campo, vale o primeiro. */
export function guessMapping(headers: string[]): Array<ImportField | null> {
  const used = new Set<ImportField>()
  return headers.map((header) => {
    const field = guessField(header)
    if (!field || used.has(field)) return null
    used.add(field)
    return field
  })
}

/* ------------------------------------------------------------------ CSV */

/** Separador pela primeira linha (fora das aspas): ";" (Excel em pt/es), "," ou tabulação. */
function detectDelimiter(text: string): string {
  const firstLine: string[] = []
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if ((ch === '\n' || ch === '\r') && !quoted) break
    else if (!quoted) firstLine.push(ch)
  }
  const count = (d: string) => firstLine.filter((c) => c === d).length
  return [';', ',', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best), ',')
}

/** Planilha CSV → linhas de células (aspas com "" escapado, CRLF, BOM do Excel). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/* ------------------------------------------------------------------ valores */

type Parsed<T> = { ok: true; value: T } | { ok: false }

/** Data AAAA-MM-DD ou no formato do idioma (dd/mm/aaaa em pt/es; mm/dd/aaaa em en). */
export function parseImportDate(text: string, locale: string): Parsed<string | null> {
  const raw = text.trim()
  if (!raw) return { ok: true, value: null }
  let y: number
  let m: number
  let d: number
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw)
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (local) {
    const [a, b] = [Number(local[1]), Number(local[2])]
    ;[d, m] = locale.startsWith('en') ? [b, a] : [a, b]
    y = Number(local[3])
  } else return { ok: false }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { ok: false }
  return { ok: true, value: date.toISOString().slice(0, 10) }
}

/** Número com vírgula ou ponto; aceita "2 h", "3 dias", "50%". */
export function parseImportNumber(text: string): Parsed<number | null> {
  const raw = text
    .trim()
    .replace(/%$/, '')
    .replace(/\s*(h|hs|horas?|hours?|d|dias?|days?|días?)$/i, '')
    .trim()
  if (!raw) return { ok: true, value: null }
  if (!/^-?\d+([.,]\d+)?$/.test(raw)) return { ok: false }
  return { ok: true, value: Number(raw.replace(',', '.')) }
}

/* ------------------------------------------------------------------ linhas */

export interface ImportPreviewRow {
  /** Linha na planilha (1 = cabeçalho). */
  line: number
  row: PlanImportRow
  /** Problemas de formato: campo → código (invalid_date, invalid_number…). */
  issues: Record<string, string>
}

export interface ImportPreview {
  headers: string[]
  mapping: Array<ImportField | null>
  rows: ImportPreviewRow[]
  /** Faltam colunas obrigatórias (grupo, elemento). */
  missing: ImportField[]
  /** Planilha grande demais. */
  tooMany: boolean
}

/** Converte a planilha (1ª linha = cabeçalho) com o mapeamento de colunas escolhido. */
export function buildImport(table: string[][], mapping: Array<ImportField | null>, locale: string): ImportPreview {
  const headers = table[0] ?? []
  const missing = REQUIRED_IMPORT_FIELDS.filter((f) => !mapping.includes(f))
  const body = table.slice(1)
  const cellOf = (cells: string[], field: ImportField) => {
    const index = mapping.indexOf(field)
    return index >= 0 ? (cells[index] ?? '').trim() : ''
  }
  const rows = body.map((cells, i) => {
    const issues: Record<string, string> = {}
    const element = cellOf(cells, 'name')
    const subitem = cellOf(cells, 'subitem')
    const date = (field: 'startDate' | 'endDate') => {
      const parsed = parseImportDate(cellOf(cells, field), locale)
      if (!parsed.ok) issues[field] = 'invalid_date'
      return parsed.ok ? parsed.value : null
    }
    const number = (field: 'estimatedHours' | 'actualHours' | 'durationDays' | 'progress') => {
      const parsed = parseImportNumber(cellOf(cells, field))
      if (!parsed.ok) issues[field] = 'invalid_number'
      return parsed.ok ? parsed.value : null
    }
    const row: PlanImportRow = {
      group: cellOf(cells, 'group'),
      name: subitem || element,
      parent: subitem ? element || null : null,
      status: cellOf(cells, 'status') || null,
      startDate: date('startDate'),
      endDate: date('endDate'),
      resources: cellOf(cells, 'resources')
        .split(/[,;|]/)
        .map((r) => r.trim())
        .filter(Boolean),
      estimatedHours: number('estimatedHours'),
      actualHours: number('actualHours'),
      durationDays: number('durationDays'),
      progress: number('progress'),
    }
    if (!row.group) issues.group = 'required'
    if (!row.name) issues.name = 'required'
    return { line: i + 2, row, issues }
  })
  return { headers, mapping, rows, missing, tooMany: rows.length > MAX_IMPORT_ROWS }
}

/** Planilha modelo (cabeçalho no idioma + exemplos), com o separador comum do idioma no Excel. */
export function importTemplate(headers: Record<ImportField, string>, samples: Array<Partial<Record<ImportField, string>>>, locale: string): string {
  const delimiter = locale.startsWith('en') ? ',' : ';'
  const escape = (value: string) => (/[",;\t\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const lines = [IMPORT_FIELDS.map((f) => escape(headers[f])).join(delimiter), ...samples.map((s) => IMPORT_FIELDS.map((f) => escape(s[f] ?? '')).join(delimiter))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

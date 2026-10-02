import { parseDate, type IsoDate } from '@shared/months'
import { zipStore } from './zip'

/**
 * Escritor de .xlsx propio y chico (sin dependencias): texto, números, fechas y un puñado de estilos fijos.
 * La PC usa exceljs; esto es para el celu, donde exceljs no anda sin polyfills de Node.
 */

export type XlsxStyle =
  | 'default'
  | 'bold'
  | 'title'
  | 'header'
  | 'ars'
  | 'arsBold'
  | 'usd'
  | 'rate'
  | 'date'
  | 'muted'
  | 'arsMuted'
  | 'warning'

/** Fecha de Excel: se escribe como número de serie con formato dd/mm/aaaa. */
export interface XlsxDate {
  date: IsoDate
}

export type XlsxValue = string | number | XlsxDate | null

export interface XlsxCell {
  v: XlsxValue
  s?: XlsxStyle
}

export interface XlsxRow {
  cells: (XlsxCell | XlsxValue)[]
  /** Estilo para las celdas que no traen uno propio. */
  style?: XlsxStyle
  outlineLevel?: number
}

export interface XlsxSheet {
  name: string
  /** Ancho de cada columna (en caracteres). */
  widths: number[]
  rows: XlsxRow[]
  /** Fija la primera fila y le pone autofiltro. */
  table?: boolean
}

const STYLE_INDEX: Record<XlsxStyle, number> = {
  default: 0,
  bold: 1,
  title: 2,
  header: 3,
  ars: 4,
  arsBold: 5,
  usd: 6,
  rate: 7,
  date: 8,
  muted: 9,
  arsMuted: 10,
  warning: 11,
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4">
<numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0.00;-&quot;$&quot; #,##0.00"/>
<numFmt numFmtId="165" formatCode="&quot;US$&quot; #,##0.00;-&quot;US$&quot; #,##0.00"/>
<numFmt numFmtId="166" formatCode="#,##0.00"/>
<numFmt numFmtId="167" formatCode="dd/mm/yyyy"/>
</numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FF4B5563"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="11"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8F5EE"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF9CA3AF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export function escapeXml(text: string): string {
  return (
    text
      // Caracteres de control que XML 1.0 no admite.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  )
}

export function columnName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

/** Número de serie de Excel (días desde 1899-12-30). */
export function excelSerial(date: IsoDate): number {
  const { year, month, day } = parseDate(date)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000
}

const isDate = (v: XlsxValue): v is XlsxDate => typeof v === 'object' && v !== null

function cellXml(ref: string, cell: XlsxCell, rowStyle: XlsxStyle | undefined): string {
  const { v } = cell
  const style = cell.s ?? (isDate(v) ? 'date' : rowStyle) ?? 'default'
  const s = STYLE_INDEX[style] === 0 ? '' : ` s="${String(STYLE_INDEX[style])}"`
  if (v === null || v === '') return s ? `<c r="${ref}"${s}/>` : ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    return `<c r="${ref}"${s}><v>${String(v)}</v></c>`
  }
  if (isDate(v)) return `<c r="${ref}"${s}><v>${String(excelSerial(v.date))}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`
}

function sheetXml(sheet: XlsxSheet): string {
  const parts: string[] = [XML_HEAD, `<worksheet xmlns="${NS}" xmlns:r="${REL_NS}">`]
  const maxOutline = Math.max(0, ...sheet.rows.map((r) => r.outlineLevel ?? 0))
  if (maxOutline > 0) {
    parts.push('<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr>')
  }
  if (sheet.table) {
    parts.push(
      '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '</sheetView></sheetViews>',
    )
  }
  parts.push(
    `<sheetFormatPr defaultRowHeight="15"${maxOutline > 0 ? ` outlineLevelRow="${String(maxOutline)}"` : ''}/>`,
  )
  if (sheet.widths.length > 0) {
    parts.push('<cols>')
    sheet.widths.forEach((w, i) => {
      parts.push(
        `<col min="${String(i + 1)}" max="${String(i + 1)}" width="${String(w)}" customWidth="1"/>`,
      )
    })
    parts.push('</cols>')
  }
  parts.push('<sheetData>')
  sheet.rows.forEach((row, r) => {
    const rowNum = String(r + 1)
    const cells = row.cells
      .map((c, i) => {
        const cell = c !== null && typeof c === 'object' && 'v' in c ? c : { v: c }
        return cellXml(`${columnName(i)}${rowNum}`, cell, row.style)
      })
      .join('')
    const outline = row.outlineLevel ? ` outlineLevel="${String(row.outlineLevel)}"` : ''
    parts.push(`<row r="${rowNum}"${outline}>${cells}</row>`)
  })
  parts.push('</sheetData>')
  if (sheet.table && sheet.rows.length > 1) {
    parts.push(`<autoFilter ref="${filterRange(sheet)}"/>`)
  }
  parts.push('</worksheet>')
  return parts.join('')
}

function filterRange(sheet: XlsxSheet): string {
  const cols = sheet.rows[0]?.cells.length ?? 1
  return `A1:${columnName(cols - 1)}${String(sheet.rows.length)}`
}

/** Nombre de hoja válido para Excel (máximo 31 caracteres, sin []:*?/\). */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Hoja'
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const enc = new TextEncoder()
  const names = sheets.map((s) => sheetName(s.name))
  const sheetEntries = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${String(i + 1)}.xml`,
    data: enc.encode(sheetXml(s)),
  }))
  const definedNames = sheets
    .map((s, i) =>
      s.table && s.rows.length > 1
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${String(i)}" hidden="1">'${escapeXml(
            (names[i] ?? '').replace(/'/g, "''"),
          )}'!${filterRange(s).replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>`
        : '',
    )
    .join('')

  const contentTypes =
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${String(i + 1)}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>'

  const rootRels =
    `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
    `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>'

  const workbook =
    `${XML_HEAD}<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets>` +
    names
      .map(
        (n, i) =>
          `<sheet name="${escapeXml(n)}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"/>`,
      )
      .join('') +
    '</sheets>' +
    (definedNames ? `<definedNames>${definedNames}</definedNames>` : '') +
    '</workbook>'

  const workbookRels =
    `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${String(i + 1)}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${String(i + 1)}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${String(sheets.length + 1)}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
    '</Relationships>'

  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
    ...sheetEntries,
  ])
}

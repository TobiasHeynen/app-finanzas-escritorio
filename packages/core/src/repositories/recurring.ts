import type { SqlDb as Db } from '../db/sql'
import type { RecurringTemplate, RecurringTemplateInput } from '@shared/types'
import type { Month } from '@shared/months'
import { notFound } from './util'

interface Row {
  id: number
  description: string
  subcategory_id: number
  category_id: number
  payment_method_id: number
  default_amount_cents: number | null
  day_of_month: number
  start_month: string
  end_month: string | null
  active: number
}

const toTemplate = (r: Row): RecurringTemplate => ({
  id: r.id,
  description: r.description,
  subcategoryId: r.subcategory_id,
  categoryId: r.category_id,
  paymentMethodId: r.payment_method_id,
  defaultAmountCents: r.default_amount_cents,
  dayOfMonth: r.day_of_month,
  startMonth: r.start_month,
  endMonth: r.end_month,
  active: r.active === 1,
})

const SELECT = `SELECT t.*, s.category_id FROM recurring_templates t JOIN subcategories s ON s.id = t.subcategory_id`

export type RecurringRepo = ReturnType<typeof createRecurringRepo>

export function createRecurringRepo(db: Db) {
  const stmts = {
    list: db.prepare<[], Row>(`${SELECT} ORDER BY t.active DESC, t.day_of_month, t.id`),
    get: db.prepare<[number], Row>(`${SELECT} WHERE t.id = ?`),
    insert: db.prepare(
      `INSERT INTO recurring_templates (description, subcategory_id, payment_method_id, default_amount_cents,
         day_of_month, start_month, end_month, active)
       VALUES (@description, @subcategoryId, @paymentMethodId, @defaultAmountCents, @dayOfMonth,
         @startMonth, @endMonth, @active)`,
    ),
    update: db.prepare(
      `UPDATE recurring_templates SET description = @description, subcategory_id = @subcategoryId,
         payment_method_id = @paymentMethodId, default_amount_cents = @defaultAmountCents,
         day_of_month = @dayOfMonth, start_month = @startMonth, end_month = @endMonth, active = @active
       WHERE id = @id`,
    ),
    delete: db.prepare('DELETE FROM recurring_templates WHERE id = ?'),
    generatedMonths: db.prepare<[number], { month: string }>(
      'SELECT month FROM recurring_generations WHERE template_id = ?',
    ),
    generatedIn: db.prepare<[string], { template_id: number }>(
      'SELECT template_id FROM recurring_generations WHERE month = ?',
    ),
    markGenerated: db.prepare(
      'INSERT INTO recurring_generations (template_id, month, expense_id) VALUES (?, ?, ?)',
    ),
  }

  const params = (input: RecurringTemplateInput) => ({ ...input, active: input.active ? 1 : 0 })

  return {
    list: (): RecurringTemplate[] => stmts.list.all().map(toTemplate),
    get: (id: number): RecurringTemplate =>
      toTemplate(stmts.get.get(id) ?? notFound('El recurrente')),
    insert: (input: RecurringTemplateInput): number =>
      Number(stmts.insert.run(params(input)).lastInsertRowid),
    update: (id: number, input: RecurringTemplateInput): void => {
      if (stmts.update.run({ ...params(input), id }).changes === 0) notFound('El recurrente')
    },
    delete: (id: number): void => {
      if (stmts.delete.run(id).changes === 0) notFound('El recurrente')
    },
    generatedMonths: (templateId: number): Set<Month> =>
      new Set(stmts.generatedMonths.all(templateId).map((r) => r.month)),
    templatesGeneratedIn: (month: Month): Set<number> =>
      new Set(stmts.generatedIn.all(month).map((r) => r.template_id)),
    markGenerated: (templateId: number, month: Month, expenseId: number): void =>
      void stmts.markGenerated.run(templateId, month, expenseId),
  }
}

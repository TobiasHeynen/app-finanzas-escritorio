import type { Db } from '../db/connection'
import { notFound } from './util'

export interface PlanRow {
  id: number
  description: string
  subcategory_id: number
  payment_method_id: number
  purchase_date: string
  total_cents: number
  installments_count: number
  first_charge_month: string
}

export interface PlanWrite {
  description: string
  subcategoryId: number
  paymentMethodId: number
  purchaseDate: string
  totalCents: number
  installmentsCount: number
  firstChargeMonth: string
}

export type InstallmentPlansRepo = ReturnType<typeof createInstallmentPlansRepo>

export function createInstallmentPlansRepo(db: Db) {
  const stmts = {
    get: db.prepare<[number], PlanRow>('SELECT * FROM installment_plans WHERE id = ?'),
    insert: db.prepare(
      `INSERT INTO installment_plans (description, subcategory_id, payment_method_id, purchase_date,
         total_cents, installments_count, first_charge_month)
       VALUES (@description, @subcategoryId, @paymentMethodId, @purchaseDate, @totalCents,
         @installmentsCount, @firstChargeMonth)`,
    ),
    update: db.prepare(
      `UPDATE installment_plans SET description = @description, subcategory_id = @subcategoryId,
         payment_method_id = @paymentMethodId, purchase_date = @purchaseDate, total_cents = @totalCents,
         installments_count = @installmentsCount, first_charge_month = @firstChargeMonth
       WHERE id = @id`,
    ),
    /** Planes con cuotas vivas desde un mes (para la pantalla de tarjetas). */
    activeFrom: db.prepare<[string], PlanRow>(
      `SELECT DISTINCT p.* FROM installment_plans p
       JOIN expenses e ON e.installment_plan_id = p.id AND e.deleted_at IS NULL
       WHERE e.charge_month >= ?
       ORDER BY p.purchase_date DESC, p.id DESC`,
    ),
    purgeOrphans: db.prepare(
      'DELETE FROM installment_plans WHERE id NOT IN (SELECT installment_plan_id FROM expenses WHERE installment_plan_id IS NOT NULL)',
    ),
  }

  return {
    get: (id: number): PlanRow => stmts.get.get(id) ?? notFound('El plan de cuotas'),
    insert: (w: PlanWrite): number => Number(stmts.insert.run(w).lastInsertRowid),
    update: (id: number, w: PlanWrite): void => {
      if (stmts.update.run({ ...w, id }).changes === 0) notFound('El plan de cuotas')
    },
    activeFrom: (month: string): PlanRow[] => stmts.activeFrom.all(month),
    purgeOrphans: (): number => stmts.purgeOrphans.run().changes,
  }
}

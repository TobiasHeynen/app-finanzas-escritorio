import type { Db } from '../db/connection'
import type { PaymentMethod, PaymentMethodInput } from '@shared/types'
import { nowIso, notFound, translateSqliteError } from './util'

interface Row {
  id: number
  name: string
  type: PaymentMethod['type']
  closing_day: number | null
  due_day: number | null
  color: string | null
  sort_order: number
  archived_at: string | null
}

const toPaymentMethod = (r: Row): PaymentMethod => ({
  id: r.id,
  name: r.name,
  type: r.type,
  closingDay: r.closing_day,
  dueDay: r.due_day,
  color: r.color,
  sortOrder: r.sort_order,
  archived: r.archived_at !== null,
})

const DUP = { unique: 'Ya existe un medio de pago con ese nombre' }

export type PaymentMethodsRepo = ReturnType<typeof createPaymentMethodsRepo>

export function createPaymentMethodsRepo(db: Db) {
  const stmts = {
    list: db.prepare<[], Row>('SELECT * FROM payment_methods ORDER BY sort_order, id'),
    get: db.prepare<[number], Row>('SELECT * FROM payment_methods WHERE id = ?'),
    nextOrder: db.prepare<[], { n: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM payment_methods',
    ),
    insert: db.prepare(
      `INSERT INTO payment_methods (name, type, closing_day, due_day, color, sort_order)
       VALUES (@name, @type, @closingDay, @dueDay, @color, @sortOrder)`,
    ),
    update: db.prepare(
      `UPDATE payment_methods SET name = @name, type = @type, closing_day = @closingDay,
       due_day = @dueDay, color = @color WHERE id = @id`,
    ),
    archive: db.prepare('UPDATE payment_methods SET archived_at = ? WHERE id = ?'),
    order: db.prepare('UPDATE payment_methods SET sort_order = ? WHERE id = ?'),
  }

  const get = (id: number): PaymentMethod =>
    toPaymentMethod(stmts.get.get(id) ?? notFound('El medio de pago'))

  return {
    list: (): PaymentMethod[] => stmts.list.all().map(toPaymentMethod),
    get,
    create(input: PaymentMethodInput): PaymentMethod {
      try {
        const { n } = stmts.nextOrder.get() ?? { n: 0 }
        const info = stmts.insert.run({ ...input, sortOrder: n })
        return get(Number(info.lastInsertRowid))
      } catch (err) {
        return translateSqliteError(err, DUP)
      }
    },
    update(id: number, input: PaymentMethodInput): PaymentMethod {
      try {
        const info = stmts.update.run({ ...input, id })
        if (info.changes === 0) notFound('El medio de pago')
        return get(id)
      } catch (err) {
        return translateSqliteError(err, DUP)
      }
    },
    setArchived(id: number, archived: boolean): PaymentMethod {
      const info = stmts.archive.run(archived ? nowIso() : null, id)
      if (info.changes === 0) notFound('El medio de pago')
      return get(id)
    },
    reorder(ids: number[]): void {
      db.transaction(() => ids.forEach((id, i) => stmts.order.run(i, id)))()
    },
  }
}

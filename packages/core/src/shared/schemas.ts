/**
 * Schemas zod de las entidades y los inputs. Son la fuente de verdad de los tipos compartidos
 * (ver types.ts). Montos siempre enteros en centavos.
 */
import { z } from 'zod'
import { MAX_CENTS } from './money'
import { isIsoDate, isMonth } from './months'

export const idSchema = z.number().int().positive()
export const monthSchema = z.string().refine(isMonth, 'Mes inválido (YYYY-MM)')
export const isoDateSchema = z.string().refine(isIsoDate, 'Fecha inválida (YYYY-MM-DD)')
export const centsSchema = z.number().int().min(0).max(MAX_CENTS)
export const signedCentsSchema = z.number().int().min(-MAX_CENTS).max(MAX_CENTS)
export const currencySchema = z.enum(['ARS', 'USD'])
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
export const dayOfMonthSchema = z.number().int().min(1).max(31)
const nameSchema = (max: number) => z.string().trim().min(1, 'Requerido').max(max)

export const paymentMethodTypeSchema = z.enum([
  'efectivo',
  'debito',
  'transferencia',
  'tarjeta_credito',
])

// ---------- Catálogo ----------

export const subcategorySchema = z.object({
  id: idSchema,
  categoryId: idSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
})

export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  subcategories: z.array(subcategorySchema),
})

export const categoryInputSchema = z
  .object({ name: nameSchema(60), icon: z.string().min(1).max(40), color: colorSchema })
  .strict()

export const subcategoryInputSchema = z
  .object({ categoryId: idSchema, name: nameSchema(60) })
  .strict()

export const paymentMethodSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: paymentMethodTypeSchema,
  closingDay: z.number().int().nullable(),
  dueDay: z.number().int().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
})

export const paymentMethodInputSchema = z
  .object({
    name: nameSchema(60),
    type: paymentMethodTypeSchema,
    closingDay: dayOfMonthSchema.nullable(),
    dueDay: dayOfMonthSchema.nullable(),
    color: colorSchema.nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === 'tarjeta_credito' && v.closingDay === null) {
      ctx.addIssue({ code: 'custom', path: ['closingDay'], message: 'Indicá el día de cierre' })
    }
  })
  .transform((v) => (v.type === 'tarjeta_credito' ? v : { ...v, closingDay: null, dueDay: null }))

// ---------- Grupos ----------

export const groupMemberSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  name: z.string(),
  archived: z.boolean(),
})

export const groupSchema = z.object({
  id: idSchema,
  name: z.string(),
  archived: z.boolean(),
  /** Incluye las personas archivadas (que se sacaron del grupo pero tienen gastos). */
  members: z.array(groupMemberSchema),
})

export const groupInputSchema = z
  .object({
    name: nameSchema(60),
    /** Personas activas del grupo. id null = nueva. Las que no vienen se archivan. */
    members: z
      .array(z.object({ id: idSchema.nullable(), name: nameSchema(40) }).strict())
      .min(2, 'Agregá al menos 2 personas')
      .max(20, 'Hasta 20 personas por grupo'),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.members.forEach((m, i) => {
      const key = m.name.toLocaleLowerCase('es-AR')
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['members', i, 'name'], message: 'Nombre repetido' })
      }
      seen.add(key)
    })
  })

/** Gasto de un grupo: a qué grupo pertenece y quién lo pagó. */
export const expenseGroupSchema = z.object({ groupId: idSchema, paidByMemberId: idSchema }).strict()

/**
 * Cómo se reparte un gasto de grupo. 'equal': partes iguales entre esas personas (el resto de centavos va
 * a la primera, como en las cuotas). 'custom': cuánto le toca a cada una; tiene que sumar el monto.
 */
export const expenseSplitSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('equal'),
      memberIds: z.array(idSchema).min(1, 'Elegí al menos una persona').max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal('custom'),
      shares: z
        .array(z.object({ memberId: idSchema, cents: centsSchema }).strict())
        .min(1)
        .max(20),
    })
    .strict(),
])

/** En los inputs: ausente o null = personal, sin grupo. Cuotas y recurrentes: partes iguales. */
const groupField = expenseGroupSchema.nullable().optional()

/** Gasto de grupo con su reparto. Sin `split` = partes iguales entre las personas activas. */
const expenseGroupField = expenseGroupSchema
  .extend({ split: expenseSplitSchema.optional() })
  .strict()
  .nullable()
  .optional()

export const settlementSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  fromMemberId: idSchema,
  toMemberId: idSchema,
  amountCents: centsSchema,
  date: isoDateSchema,
  note: z.string(),
})

export const settlementInputSchema = z
  .object({
    groupId: idSchema,
    fromMemberId: idSchema,
    toMemberId: idSchema,
    amountCents: centsSchema.refine((v) => v > 0, 'El monto tiene que ser mayor a 0'),
    date: isoDateSchema,
    note: z.string().trim().max(200),
  })
  .strict()
  .refine((v) => v.fromMemberId !== v.toMemberId, {
    path: ['toMemberId'],
    message: 'Tienen que ser dos personas distintas',
  })

export const groupBalanceSchema = z.object({
  groupId: idSchema,
  /** Suma de los gastos del grupo con monto (los pendientes no cuentan). */
  totalCents: centsSchema,
  expenseCount: z.number().int(),
  pendingCount: z.number().int(),
  members: z.array(
    z.object({
      memberId: idSchema,
      paidCents: centsSchema,
      shareCents: centsSchema,
      /** Positivo: le deben. Negativo: debe. Incluye los pagos para saldar. */
      balanceCents: signedCentsSchema,
    }),
  ),
  /** La menor cantidad de pagos para quedar a mano. */
  transfers: z.array(
    z.object({ fromMemberId: idSchema, toMemberId: idSchema, amountCents: centsSchema }),
  ),
  settlements: z.array(settlementSchema),
})

// ---------- Gastos ----------

export const expenseSchema = z.object({
  id: idSchema,
  subcategoryId: idSchema,
  categoryId: idSchema,
  paymentMethodId: idSchema,
  description: z.string(),
  purchaseDate: isoDateSchema,
  chargeMonth: monthSchema,
  chargeMonthLocked: z.boolean(),
  amountCents: centsSchema.nullable(),
  installment: z
    .object({ planId: idSchema, number: z.number().int(), count: z.number().int() })
    .nullable(),
  recurringTemplateId: idSchema.nullable(),
  notes: z.string().nullable(),
  group: expenseGroupSchema.extend({ split: expenseSplitSchema }).nullable(),
})

/** Gasto recurrente proyectado en un mes futuro: no está guardado, se muestra en gris. */
export const projectedExpenseSchema = z.object({
  templateId: idSchema,
  description: z.string(),
  subcategoryId: idSchema,
  categoryId: idSchema,
  paymentMethodId: idSchema,
  amountCents: centsSchema.nullable(),
  date: isoDateSchema,
  month: monthSchema,
  group: expenseGroupSchema.nullable(),
})

export const expenseInputSchema = z
  .object({
    subcategoryId: idSchema,
    paymentMethodId: idSchema,
    description: z.string().trim().max(200),
    purchaseDate: isoDateSchema,
    amountCents: centsSchema.nullable(),
    /** Si viene, el mes de imputación queda fijado a mano. */
    chargeMonthOverride: monthSchema.nullable(),
    notes: z.string().trim().max(1000).nullable(),
    group: expenseGroupField,
  })
  .strict()

export const installmentPlanInputSchema = z
  .object({
    subcategoryId: idSchema,
    paymentMethodId: idSchema,
    description: z.string().trim().max(200),
    purchaseDate: isoDateSchema,
    totalCents: centsSchema.refine((v) => v > 0, 'El total tiene que ser mayor a 0'),
    installmentsCount: z.number().int().min(2).max(120),
    /** "Voy por la cuota N": se generan sólo las cuotas N..count. 1 = plan nuevo. */
    startAtInstallment: z.number().int().min(1),
    /** Mes de la cuota `startAtInstallment`. null = calculado (mes de imputación de la compra). */
    firstChargeMonthOverride: monthSchema.nullable(),
    notes: z.string().trim().max(1000).nullable(),
    group: groupField,
  })
  .strict()
  .refine((v) => v.startAtInstallment <= v.installmentsCount, {
    path: ['startAtInstallment'],
    message: 'La cuota actual no puede ser mayor a la cantidad de cuotas',
  })

export const installmentPlanSchema = z.object({
  id: idSchema,
  description: z.string(),
  subcategoryId: idSchema,
  categoryId: idSchema,
  paymentMethodId: idSchema,
  purchaseDate: isoDateSchema,
  totalCents: centsSchema,
  installmentsCount: z.number().int(),
  firstChargeMonth: monthSchema,
  group: expenseGroupSchema.nullable(),
  /** Cuotas existentes (no borradas). */
  installments: z.array(
    z.object({
      expenseId: idSchema,
      number: z.number().int(),
      month: monthSchema,
      amountCents: centsSchema,
    }),
  ),
})

export const planScopeSchema = z.enum(['all', 'future'])

/** Edición de un plan: la fecha de compra y los meses no se editan (para eso, borrar y volver a cargar). */
export const installmentPlanUpdateSchema = z
  .object({
    subcategoryId: idSchema,
    paymentMethodId: idSchema,
    description: z.string().trim().max(200),
    totalCents: centsSchema.refine((v) => v > 0, 'El total tiene que ser mayor a 0'),
    installmentsCount: z.number().int().min(2).max(120),
    notes: z.string().trim().max(1000).nullable(),
    group: groupField,
  })
  .strict()

// ---------- Recurrentes ----------

export const recurringTemplateSchema = z.object({
  id: idSchema,
  description: z.string(),
  subcategoryId: idSchema,
  categoryId: idSchema,
  paymentMethodId: idSchema,
  defaultAmountCents: centsSchema.nullable(),
  dayOfMonth: z.number().int(),
  startMonth: monthSchema,
  endMonth: monthSchema.nullable(),
  active: z.boolean(),
  group: expenseGroupSchema.nullable(),
})

export const recurringTemplateInputSchema = z
  .object({
    description: nameSchema(120),
    subcategoryId: idSchema,
    paymentMethodId: idSchema,
    defaultAmountCents: centsSchema.nullable(),
    dayOfMonth: dayOfMonthSchema,
    startMonth: monthSchema,
    endMonth: monthSchema.nullable(),
    active: z.boolean(),
    group: groupField,
  })
  .strict()
  .refine((v) => v.endMonth === null || v.endMonth >= v.startMonth, {
    path: ['endMonth'],
    message: 'El mes de fin tiene que ser posterior al de inicio',
  })

// ---------- Ingresos ----------

export const incomeTypeSchema = z.enum(['sueldo', 'aguinaldo', 'freelance', 'otro'])

export const incomeSchema = z.object({
  id: idSchema,
  month: monthSchema,
  type: incomeTypeSchema,
  description: z.string(),
  amountCents: centsSchema,
  date: isoDateSchema,
})

export const incomeInputSchema = z
  .object({
    month: monthSchema,
    type: incomeTypeSchema,
    description: z.string().trim().max(200),
    amountCents: centsSchema,
    date: isoDateSchema,
  })
  .strict()

// ---------- Ahorros ----------

export const savingsGoalSchema = z.object({
  id: idSchema,
  name: z.string(),
  currency: currencySchema,
  targetMinor: centsSchema,
  targetDate: isoDateSchema.nullable(),
  archived: z.boolean(),
  savedMinor: signedCentsSchema,
})

export const savingsGoalInputSchema = z
  .object({
    name: nameSchema(80),
    currency: currencySchema,
    targetMinor: centsSchema.refine((v) => v > 0, 'El objetivo tiene que ser mayor a 0'),
    targetDate: isoDateSchema.nullable(),
  })
  .strict()

export const savingsMovementSchema = z.object({
  id: idSchema,
  date: isoDateSchema,
  month: monthSchema,
  currency: currencySchema,
  amountMinor: signedCentsSchema,
  arsCostCents: centsSchema.nullable(),
  rateCentsPerUsd: centsSchema.nullable(),
  goalId: idSchema.nullable(),
  note: z.string(),
})

export const savingsMovementInputSchema = z
  .object({
    date: isoDateSchema,
    /** Mes de imputación para el disponible. Por defecto el de la fecha. */
    month: monthSchema,
    currency: currencySchema,
    kind: z.enum(['aporte', 'retiro']),
    amountMinor: centsSchema.refine((v) => v > 0, 'El monto tiene que ser mayor a 0'),
    /** Sólo USD: ARS pagados (aporte) o recibidos (retiro). */
    arsCents: centsSchema.nullable(),
    goalId: idSchema.nullable(),
    note: z.string().trim().max(200),
  })
  .strict()
  .refine((v) => v.currency === 'USD' || v.arsCents === null, {
    path: ['arsCents'],
    message: 'Sólo los movimientos en USD llevan monto en pesos',
  })

export const goalProgressSchema = savingsGoalSchema.extend({
  /** Lo que falta para el objetivo (0 si ya se llegó). */
  remainingMinor: centsSchema,
  /** Meses para aportar, contando el actual, hasta el mes de la fecha objetivo. null sin fecha. */
  monthsLeft: z.number().int().nullable(),
  /** Cuánto aportar por mes para llegar a tiempo. null sin fecha, vencida o cumplida. */
  perMonthMinor: centsSchema.nullable(),
  overdue: z.boolean(),
})

export const savingsOverviewSchema = z.object({
  balances: z.object({ ARS: signedCentsSchema, USD: signedCentsSchema }),
  lastRate: z.object({ rateCentsPerUsd: centsSchema, date: isoDateSchema }).nullable(),
  /** Saldo USD valuado a la última cotización cargada. null si no hay cotización. */
  usdInArsCents: signedCentsSchema.nullable(),
  movements: z.array(savingsMovementSchema),
  goals: z.array(goalProgressSchema),
})

// ---------- Resumen del mes ----------

export const monthSummarySchema = z.object({
  month: monthSchema,
  incomeCents: signedCentsSchema,
  spentCents: signedCentsSchema,
  /** Aportes netos de ahorro que salen del disponible (aportes ARS + ARS usados para comprar USD − retiros). */
  savedCents: signedCentsSchema,
  availableCents: signedCentsSchema,
  pendingCount: z.number().int(),
  projectedCount: z.number().int(),
  byCategory: z.array(z.object({ categoryId: idSchema, amountCents: signedCentsSchema })),
})

// ---------- Tarjetas ----------

export const planProgressSchema = z.object({
  planId: idSchema,
  description: z.string(),
  subcategoryId: idSchema,
  categoryId: idSchema,
  installmentsCount: z.number().int(),
  /** Cuotas con mes <= actual (incluye las anteriores a "voy por la cuota N"). */
  paidCount: z.number().int(),
  nextAmountCents: centsSchema.nullable(),
  /** Suma de las cuotas de meses posteriores al actual. */
  remainingCents: centsSchema,
  lastMonth: monthSchema,
})

export const cardOverviewSchema = z.object({
  paymentMethodId: idSchema,
  dueThisMonth: z.object({
    month: monthSchema,
    dueDate: isoDateSchema.nullable(),
    totalCents: centsSchema,
    count: z.number().int(),
    pendingCount: z.number().int(),
  }),
  openStatement: z.object({
    chargeMonth: monthSchema,
    closingDate: isoDateSchema,
    totalCents: centsSchema,
    count: z.number().int(),
  }),
  plans: z.array(planProgressSchema),
  committedCents: centsSchema,
})

export const cardsOverviewSchema = z.object({
  currentMonth: monthSchema,
  cards: z.array(cardOverviewSchema),
  committedByMonth: z.array(
    z.object({
      month: monthSchema,
      totalCents: centsSchema,
      byCard: z.array(z.object({ paymentMethodId: idSchema, totalCents: centsSchema })),
    }),
  ),
  committedTotalCents: centsSchema,
})

// ---------- Reporte anual ----------

const twelve = z.array(signedCentsSchema).length(12)

export const reportRowSchema = z.object({
  byMonth: twelve,
  totalCents: signedCentsSchema,
  /** Total / meses con movimientos del año (ver monthsWithData). */
  averageCents: signedCentsSchema,
})

export const yearReportSchema = z.object({
  year: z.number().int(),
  months: z.array(monthSchema).length(12),
  /** Primer mes del año que es futuro (incluye recurrentes proyectados). null si no hay. */
  projectedFrom: monthSchema.nullable(),
  monthsWithData: z.number().int(),
  income: reportRowSchema,
  spent: reportRowSchema,
  saved: reportRowSchema,
  available: reportRowSchema,
  pendingCount: z.number().int(),
  categories: z.array(
    reportRowSchema.extend({
      categoryId: idSchema,
      subcategories: z.array(reportRowSchema.extend({ subcategoryId: idSchema })),
    }),
  ),
  availableYears: z.array(z.number().int()),
})

// ---------- Exportación ----------

export const exportRequestSchema = z
  .object({
    scope: z.enum(['month', 'year']),
    /** 'YYYY-MM' para un mes, 'YYYY' para un año. */
    period: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Período inválido'),
    format: z.enum(['xlsx', 'csv']),
  })
  .strict()
  .refine((v) => (v.scope === 'month') === (v.period.length === 7), {
    path: ['period'],
    message: 'El período no coincide con el alcance',
  })

export const exportResultSchema = z.object({
  saved: z.boolean(),
  path: z.string().nullable(),
})

// ---------- Backups ----------

export const backupInfoSchema = z.object({
  name: z.string(),
  reason: z.enum(['inicio', 'manual', 'pre-migracion', 'pre-restauracion']),
  createdAt: z.string(),
  sizeBytes: z.number().int(),
})

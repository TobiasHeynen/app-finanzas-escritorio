import { z } from 'zod'
import type { IpcChannel } from './channels'
import {
  backupInfoSchema,
  cardsOverviewSchema,
  categoryInputSchema,
  categorySchema,
  centsSchema,
  expenseInputSchema,
  exportRequestSchema,
  exportResultSchema,
  expenseSchema,
  groupBalanceSchema,
  groupInputSchema,
  groupSchema,
  idSchema,
  incomeInputSchema,
  incomeSchema,
  installmentPlanInputSchema,
  installmentPlanSchema,
  installmentPlanUpdateSchema,
  monthSchema,
  monthSummarySchema,
  paymentMethodInputSchema,
  paymentMethodSchema,
  planScopeSchema,
  projectedExpenseSchema,
  recurringTemplateInputSchema,
  recurringTemplateSchema,
  savingsGoalInputSchema,
  savingsGoalSchema,
  savingsMovementInputSchema,
  savingsMovementSchema,
  savingsOverviewSchema,
  settlementInputSchema,
  settlementSchema,
  subcategorySchema,
  yearReportSchema,
} from '../schemas'

const empty = z.object({}).strict()
const ok = z.object({ ok: z.literal(true) })
const idInput = z.object({ id: idSchema }).strict()
const archiveInput = z.object({ id: idSchema, archived: z.boolean() }).strict()
const reorderInput = z.object({ ids: z.array(idSchema).max(500) }).strict()
const idsOutput = z.object({ ids: z.array(idSchema) })

/**
 * Contrato IPC: fuente de verdad de cada canal (input y output).
 * - main valida el input con `input.parse` antes de llamar al handler.
 * - preload y renderer sólo usan los tipos inferidos (import type), nunca zod en runtime.
 */
export const ipcContract = {
  'app:ping': {
    input: z.object({ message: z.string().trim().min(1).max(200) }).strict(),
    output: z.object({
      reply: z.string(),
      receivedAt: z.iso.datetime(),
      versions: z.object({ app: z.string(), electron: z.string(), node: z.string() }),
    }),
  },
  'app:info': {
    input: empty,
    output: z.object({ version: z.string(), dataPath: z.string(), today: z.string() }),
  },

  // ---------- Catálogo ----------
  'catalog:list': { input: empty, output: z.array(categorySchema) },
  'catalog:createCategory': { input: categoryInputSchema, output: categorySchema },
  'catalog:updateCategory': {
    input: categoryInputSchema.extend({ id: idSchema }).strict(),
    output: categorySchema,
  },
  'catalog:archiveCategory': { input: archiveInput, output: categorySchema },
  'catalog:reorderCategories': { input: reorderInput, output: ok },
  'catalog:createSubcategory': {
    input: z.object({ categoryId: idSchema, name: z.string().trim().min(1).max(60) }).strict(),
    output: subcategorySchema,
  },
  'catalog:renameSubcategory': {
    input: z.object({ id: idSchema, name: z.string().trim().min(1).max(60) }).strict(),
    output: subcategorySchema,
  },
  'catalog:archiveSubcategory': { input: archiveInput, output: subcategorySchema },
  'catalog:reorderSubcategories': {
    input: reorderInput.extend({ categoryId: idSchema }).strict(),
    output: ok,
  },

  // ---------- Medios de pago ----------
  'paymentMethods:list': { input: empty, output: z.array(paymentMethodSchema) },
  'paymentMethods:create': { input: paymentMethodInputSchema, output: paymentMethodSchema },
  'paymentMethods:update': {
    input: z.object({ id: idSchema, data: paymentMethodInputSchema }).strict(),
    output: paymentMethodSchema,
  },
  'paymentMethods:archive': { input: archiveInput, output: paymentMethodSchema },
  'paymentMethods:reorder': { input: reorderInput, output: ok },

  // ---------- Grupos ----------
  'groups:list': { input: empty, output: z.array(groupSchema) },
  'groups:create': { input: groupInputSchema, output: groupSchema },
  'groups:update': {
    input: z.object({ id: idSchema, data: groupInputSchema }).strict(),
    output: groupSchema,
  },
  'groups:archive': { input: archiveInput, output: groupSchema },
  'groups:balance': {
    input: z.object({ groupId: idSchema }).strict(),
    output: groupBalanceSchema,
  },
  'groups:settle': { input: settlementInputSchema, output: settlementSchema },
  'groups:removeSettlement': { input: idInput, output: ok },
  'groups:restoreSettlement': { input: idInput, output: ok },

  // ---------- Mes ----------
  'month:overview': {
    input: z.object({ month: monthSchema }).strict(),
    output: z.object({
      expenses: z.array(expenseSchema),
      projected: z.array(projectedExpenseSchema),
      summary: monthSummarySchema,
    }),
  },

  // ---------- Gastos ----------
  'expenses:create': { input: expenseInputSchema, output: expenseSchema },
  'expenses:update': {
    input: z.object({ id: idSchema, data: expenseInputSchema }).strict(),
    output: expenseSchema,
  },
  'expenses:setAmount': {
    input: z.object({ id: idSchema, amountCents: centsSchema.nullable() }).strict(),
    output: expenseSchema,
  },
  'expenses:duplicate': { input: idInput, output: expenseSchema },
  'expenses:remove': { input: idInput, output: idsOutput },
  'expenses:restore': {
    input: z.object({ ids: z.array(idSchema).min(1).max(500) }).strict(),
    output: z.object({ restored: z.number().int() }),
  },
  'expenses:search': {
    input: z
      .object({
        fromMonth: monthSchema,
        toMonth: monthSchema,
        text: z.string().trim().max(100).nullable(),
        categoryId: idSchema.nullable(),
        paymentMethodId: idSchema.nullable(),
        groupId: idSchema.nullable().optional(),
      })
      .strict(),
    output: z.array(expenseSchema),
  },

  // ---------- Cuotas ----------
  'plans:create': { input: installmentPlanInputSchema, output: installmentPlanSchema },
  'plans:get': { input: idInput, output: installmentPlanSchema },
  'plans:update': {
    input: z
      .object({ id: idSchema, data: installmentPlanUpdateSchema, scope: planScopeSchema })
      .strict(),
    output: installmentPlanSchema,
  },
  'plans:remove': {
    input: z.object({ id: idSchema, scope: planScopeSchema }).strict(),
    output: idsOutput,
  },

  // ---------- Recurrentes ----------
  'recurring:list': { input: empty, output: z.array(recurringTemplateSchema) },
  'recurring:create': { input: recurringTemplateInputSchema, output: recurringTemplateSchema },
  'recurring:update': {
    input: z.object({ id: idSchema, data: recurringTemplateInputSchema }).strict(),
    output: recurringTemplateSchema,
  },
  'recurring:remove': { input: idInput, output: ok },

  // ---------- Ingresos ----------
  'incomes:list': {
    input: z.object({ month: monthSchema }).strict(),
    output: z.array(incomeSchema),
  },
  'incomes:create': { input: incomeInputSchema, output: incomeSchema },
  'incomes:update': {
    input: z.object({ id: idSchema, data: incomeInputSchema }).strict(),
    output: incomeSchema,
  },
  'incomes:remove': { input: idInput, output: ok },
  'incomes:restore': { input: idInput, output: ok },
  'incomes:copyPreviousSalary': {
    input: z.object({ month: monthSchema }).strict(),
    output: incomeSchema.nullable(),
  },

  // ---------- Tarjetas ----------
  'cards:overview': { input: empty, output: cardsOverviewSchema },

  // ---------- Ahorros ----------
  'savings:overview': { input: empty, output: savingsOverviewSchema },
  'savings:createMovement': { input: savingsMovementInputSchema, output: savingsMovementSchema },
  'savings:updateMovement': {
    input: z.object({ id: idSchema, data: savingsMovementInputSchema }).strict(),
    output: savingsMovementSchema,
  },
  'savings:removeMovement': { input: idInput, output: ok },
  'savings:restoreMovement': { input: idInput, output: ok },
  'savings:createGoal': { input: savingsGoalInputSchema, output: savingsGoalSchema },
  'savings:updateGoal': {
    input: z.object({ id: idSchema, data: savingsGoalInputSchema }).strict(),
    output: savingsGoalSchema,
  },
  'savings:archiveGoal': { input: archiveInput, output: savingsGoalSchema },

  // ---------- Reporte y exportación ----------
  'report:year': {
    input: z.object({ year: z.number().int().min(2000).max(2100) }).strict(),
    output: yearReportSchema,
  },
  'export:run': { input: exportRequestSchema, output: exportResultSchema },
  'export:reveal': { input: empty, output: ok },

  // ---------- Backups ----------
  'backups:list': { input: empty, output: z.array(backupInfoSchema) },
  'backups:create': { input: empty, output: backupInfoSchema },
  'backups:openFolder': { input: empty, output: ok },
  'backups:restore': {
    input: z.object({ name: z.string().max(100) }).strict(),
    output: z.object({ restarting: z.boolean() }),
  },
  'backups:restoreFromFile': { input: empty, output: z.object({ restarting: z.boolean() }) },
} as const satisfies Record<IpcChannel, { input: z.ZodType; output: z.ZodType }>

export type IpcContract = typeof ipcContract
export type IpcInput<C extends IpcChannel> = z.input<IpcContract[C]['input']>
export type IpcParsedInput<C extends IpcChannel> = z.output<IpcContract[C]['input']>
export type IpcOutput<C extends IpcChannel> = z.output<IpcContract[C]['output']>

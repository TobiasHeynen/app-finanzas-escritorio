import type { z } from 'zod'
import type * as s from './schemas'

export type PaymentMethodType = z.infer<typeof s.paymentMethodTypeSchema>
export type Category = z.infer<typeof s.categorySchema>
export type Subcategory = z.infer<typeof s.subcategorySchema>
export type CategoryInput = z.infer<typeof s.categoryInputSchema>
export type SubcategoryInput = z.infer<typeof s.subcategoryInputSchema>
export type PaymentMethod = z.infer<typeof s.paymentMethodSchema>
export type PaymentMethodInput = z.output<typeof s.paymentMethodInputSchema>
export type Expense = z.infer<typeof s.expenseSchema>
export type ProjectedExpense = z.infer<typeof s.projectedExpenseSchema>
export type ExpenseInput = z.infer<typeof s.expenseInputSchema>
export type InstallmentPlan = z.infer<typeof s.installmentPlanSchema>
export type InstallmentPlanInput = z.infer<typeof s.installmentPlanInputSchema>
export type InstallmentPlanUpdate = z.infer<typeof s.installmentPlanUpdateSchema>
export type PlanScope = z.infer<typeof s.planScopeSchema>
export type RecurringTemplate = z.infer<typeof s.recurringTemplateSchema>
export type RecurringTemplateInput = z.infer<typeof s.recurringTemplateInputSchema>
export type IncomeType = z.infer<typeof s.incomeTypeSchema>
export type Income = z.infer<typeof s.incomeSchema>
export type IncomeInput = z.infer<typeof s.incomeInputSchema>
export type SavingsGoal = z.infer<typeof s.savingsGoalSchema>
export type SavingsGoalInput = z.infer<typeof s.savingsGoalInputSchema>
export type SavingsMovement = z.infer<typeof s.savingsMovementSchema>
export type SavingsMovementInput = z.infer<typeof s.savingsMovementInputSchema>
export type GoalProgress = z.infer<typeof s.goalProgressSchema>
export type SavingsOverview = z.infer<typeof s.savingsOverviewSchema>
export type MonthSummary = z.infer<typeof s.monthSummarySchema>
export type PlanProgress = z.infer<typeof s.planProgressSchema>
export type CardOverview = z.infer<typeof s.cardOverviewSchema>
export type CardsOverview = z.infer<typeof s.cardsOverviewSchema>

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  transferencia: 'Transferencia',
  tarjeta_credito: 'Tarjeta de crédito',
}

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  sueldo: 'Sueldo',
  aguinaldo: 'Aguinaldo',
  freelance: 'Freelance',
  otro: 'Otro',
}
export type ReportRow = z.infer<typeof s.reportRowSchema>
export type YearReport = z.infer<typeof s.yearReportSchema>
export type ExportRequest = z.infer<typeof s.exportRequestSchema>
export type ExportResult = z.infer<typeof s.exportResultSchema>
export type BackupInfo = z.infer<typeof s.backupInfoSchema>

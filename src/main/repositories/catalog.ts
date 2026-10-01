import type { Db } from '../db/connection'
import type { Category, CategoryInput, Subcategory } from '@shared/types'
import { nowIso, notFound, translateSqliteError } from './util'

interface CategoryRow {
  id: number
  name: string
  icon: string
  color: string
  sort_order: number
  archived_at: string | null
}

interface SubcategoryRow {
  id: number
  category_id: number
  name: string
  sort_order: number
  archived_at: string | null
}

const toSubcategory = (r: SubcategoryRow): Subcategory => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  sortOrder: r.sort_order,
  archived: r.archived_at !== null,
})

const DUP_CATEGORY = { unique: 'Ya existe una categoría con ese nombre' }
const DUP_SUBCATEGORY = { unique: 'Ya existe una subcategoría con ese nombre en esta categoría' }

export type CatalogRepo = ReturnType<typeof createCatalogRepo>

export function createCatalogRepo(db: Db) {
  const stmts = {
    categories: db.prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY sort_order, id'),
    subcategories: db.prepare<[], SubcategoryRow>(
      'SELECT * FROM subcategories ORDER BY sort_order, id',
    ),
    category: db.prepare<[number], CategoryRow>('SELECT * FROM categories WHERE id = ?'),
    subcategory: db.prepare<[number], SubcategoryRow>('SELECT * FROM subcategories WHERE id = ?'),
    nextCategoryOrder: db.prepare<[], { n: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories',
    ),
    nextSubOrder: db.prepare<[number], { n: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM subcategories WHERE category_id = ?',
    ),
    insertCategory: db.prepare(
      'INSERT INTO categories (name, icon, color, sort_order) VALUES (@name, @icon, @color, @sortOrder)',
    ),
    updateCategory: db.prepare(
      'UPDATE categories SET name = @name, icon = @icon, color = @color WHERE id = @id',
    ),
    archiveCategory: db.prepare('UPDATE categories SET archived_at = ? WHERE id = ?'),
    orderCategory: db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?'),
    insertSub: db.prepare(
      'INSERT INTO subcategories (category_id, name, sort_order) VALUES (?, ?, ?)',
    ),
    renameSub: db.prepare('UPDATE subcategories SET name = ? WHERE id = ?'),
    archiveSub: db.prepare('UPDATE subcategories SET archived_at = ? WHERE id = ?'),
    orderSub: db.prepare(
      'UPDATE subcategories SET sort_order = ? WHERE id = ? AND category_id = ?',
    ),
  }

  function getCategory(id: number): Category {
    const row = stmts.category.get(id) ?? notFound('La categoría')
    const subs = stmts.subcategories
      .all()
      .filter((s) => s.category_id === id)
      .map(toSubcategory)
    return mapCategory(row, subs)
  }

  const getSub = (id: number): Subcategory =>
    toSubcategory(stmts.subcategory.get(id) ?? notFound('La subcategoría'))

  return {
    listCategories(): Category[] {
      const subsByCategory = new Map<number, Subcategory[]>()
      for (const row of stmts.subcategories.all()) {
        const list = subsByCategory.get(row.category_id) ?? []
        list.push(toSubcategory(row))
        subsByCategory.set(row.category_id, list)
      }
      return stmts.categories.all().map((r) => mapCategory(r, subsByCategory.get(r.id) ?? []))
    },

    getCategory,

    getSubcategory(id: number): Subcategory & { categoryArchived: boolean } {
      const row = stmts.subcategory.get(id) ?? notFound('La subcategoría')
      const category = stmts.category.get(row.category_id) ?? notFound('La categoría')
      return { ...toSubcategory(row), categoryArchived: category.archived_at !== null }
    },

    createCategory(input: CategoryInput): Category {
      try {
        const { n } = stmts.nextCategoryOrder.get() ?? { n: 0 }
        const info = stmts.insertCategory.run({ ...input, sortOrder: n })
        return getCategory(Number(info.lastInsertRowid))
      } catch (err) {
        return translateSqliteError(err, DUP_CATEGORY)
      }
    },

    updateCategory(id: number, input: CategoryInput): Category {
      try {
        const info = stmts.updateCategory.run({ ...input, id })
        if (info.changes === 0) notFound('La categoría')
        return getCategory(id)
      } catch (err) {
        return translateSqliteError(err, DUP_CATEGORY)
      }
    },

    setCategoryArchived(id: number, archived: boolean): Category {
      const info = stmts.archiveCategory.run(archived ? nowIso() : null, id)
      if (info.changes === 0) notFound('La categoría')
      return getCategory(id)
    },

    reorderCategories(ids: number[]): void {
      db.transaction(() => ids.forEach((id, i) => stmts.orderCategory.run(i, id)))()
    },

    createSubcategory(categoryId: number, name: string): Subcategory {
      try {
        if (!stmts.category.get(categoryId)) notFound('La categoría')
        const { n } = stmts.nextSubOrder.get(categoryId) ?? { n: 0 }
        const info = stmts.insertSub.run(categoryId, name, n)
        return getSub(Number(info.lastInsertRowid))
      } catch (err) {
        return translateSqliteError(err, DUP_SUBCATEGORY)
      }
    },

    renameSubcategory(id: number, name: string): Subcategory {
      try {
        const info = stmts.renameSub.run(name, id)
        if (info.changes === 0) notFound('La subcategoría')
        return getSub(id)
      } catch (err) {
        return translateSqliteError(err, DUP_SUBCATEGORY)
      }
    },

    setSubcategoryArchived(id: number, archived: boolean): Subcategory {
      const info = stmts.archiveSub.run(archived ? nowIso() : null, id)
      if (info.changes === 0) notFound('La subcategoría')
      return getSub(id)
    },

    reorderSubcategories(categoryId: number, ids: number[]): void {
      db.transaction(() => ids.forEach((id, i) => stmts.orderSub.run(i, id, categoryId)))()
    },
  }
}

function mapCategory(r: CategoryRow, subcategories: Subcategory[]): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    sortOrder: r.sort_order,
    archived: r.archived_at !== null,
    subcategories,
  }
}

-- 004: las categorías activas sin ninguna subcategoría activa no aparecían al cargar un gasto (los gastos van
-- siempre a una subcategoría). Se les agrega "General" o, si ya la tenían archivada, se desarchiva.
UPDATE subcategories
SET archived_at = NULL
WHERE name = 'General'
  AND category_id IN (
    SELECT c.id FROM categories c
    WHERE c.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM subcategories s WHERE s.category_id = c.id AND s.archived_at IS NULL
      )
  );

INSERT INTO subcategories (category_id, name, sort_order)
SELECT c.id, 'General', 0
FROM categories c
WHERE c.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM subcategories s WHERE s.category_id = c.id AND s.archived_at IS NULL
  );

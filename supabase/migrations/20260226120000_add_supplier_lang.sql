-- Add supplier language preference for localized requisition email/PDF output

ALTER TABLE suppliers
ADD COLUMN lang VARCHAR(20) NOT NULL DEFAULT 'english';

ALTER TABLE suppliers
ADD CONSTRAINT suppliers_lang_check
CHECK (lang IN ('english', 'chinese'));

COMMENT ON COLUMN suppliers.lang IS 'Preferred communication language for supplier documents and emails';

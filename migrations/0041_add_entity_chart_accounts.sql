
-- Add entity-specific accounts to chart of accounts
-- These will be sub-accounts linked to main accounts

-- Add columns to chart_of_accounts for entity linking
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('project', 'customer', 'supplier'));
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS entity_id INTEGER;

-- Create indexes for entity accounts
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_entity ON chart_of_accounts(entity_type, entity_id);

-- Insert project-specific accounts template
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, description, entity_type) VALUES
('4000-P', 'Project Revenue Template', 'revenue', 'operating_revenue', 'Template for project-specific revenue accounts', 'project'),
('5000-P', 'Project Costs Template', 'expense', 'cost_of_sales', 'Template for project-specific cost accounts', 'project');

-- Insert customer-specific receivables template
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, description, entity_type) VALUES
('1100-C', 'Customer Receivables Template', 'asset', 'current_assets', 'Template for customer-specific receivables', 'customer');

-- Insert supplier-specific payables template  
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, description, entity_type) VALUES
('2000-S', 'Supplier Payables Template', 'liability', 'current_liabilities', 'Template for supplier-specific payables', 'supplier');

-- Function to create project-specific accounts
CREATE OR REPLACE FUNCTION create_project_accounts(p_project_id INTEGER, p_project_title TEXT) 
RETURNS VOID AS $$
BEGIN
    -- Project Revenue Account
    INSERT INTO chart_of_accounts (
        account_code, 
        account_name, 
        account_type, 
        account_category, 
        description, 
        entity_type, 
        entity_id,
        parent_account_id
    ) VALUES (
        '4000-P-' || p_project_id,
        'Project Revenue - ' || p_project_title,
        'revenue',
        'operating_revenue',
        'Revenue account for project: ' || p_project_title,
        'project',
        p_project_id,
        (SELECT id FROM chart_of_accounts WHERE account_code = '4000' LIMIT 1)
    ) ON CONFLICT (account_code) DO NOTHING;

    -- Project Cost Account
    INSERT INTO chart_of_accounts (
        account_code, 
        account_name, 
        account_type, 
        account_category, 
        description, 
        entity_type, 
        entity_id,
        parent_account_id
    ) VALUES (
        '5000-P-' || p_project_id,
        'Project Costs - ' || p_project_title,
        'expense',
        'cost_of_sales',
        'Cost account for project: ' || p_project_title,
        'project',
        p_project_id,
        (SELECT id FROM chart_of_accounts WHERE account_code = '5000' LIMIT 1)
    ) ON CONFLICT (account_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to create customer-specific accounts
CREATE OR REPLACE FUNCTION create_customer_accounts(p_customer_id INTEGER, p_customer_name TEXT) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO chart_of_accounts (
        account_code, 
        account_name, 
        account_type, 
        account_category, 
        description, 
        entity_type, 
        entity_id,
        parent_account_id
    ) VALUES (
        '1100-C-' || p_customer_id,
        'Receivables - ' || p_customer_name,
        'asset',
        'current_assets',
        'Receivables account for customer: ' || p_customer_name,
        'customer',
        p_customer_id,
        (SELECT id FROM chart_of_accounts WHERE account_code = '1100' LIMIT 1)
    ) ON CONFLICT (account_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to create supplier-specific accounts
CREATE OR REPLACE FUNCTION create_supplier_accounts(p_supplier_id INTEGER, p_supplier_name TEXT) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO chart_of_accounts (
        account_code, 
        account_name, 
        account_type, 
        account_category, 
        description, 
        entity_type, 
        entity_id,
        parent_account_id
    ) VALUES (
        '2000-S-' || p_supplier_id,
        'Payables - ' || p_supplier_name,
        'liability',
        'current_liabilities',
        'Payables account for supplier: ' || p_supplier_name,
        'supplier',
        p_supplier_id,
        (SELECT id FROM chart_of_accounts WHERE account_code = '2000' LIMIT 1)
    ) ON CONFLICT (account_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create accounts for existing projects
DO $$
DECLARE
    proj RECORD;
BEGIN
    FOR proj IN SELECT id, title FROM projects
    LOOP
        PERFORM create_project_accounts(proj.id, proj.title);
    END LOOP;
END
$$;

-- Create accounts for existing customers
DO $$
DECLARE
    cust RECORD;
BEGIN
    FOR cust IN SELECT id, name FROM customers
    LOOP
        PERFORM create_customer_accounts(cust.id, cust.name);
    END LOOP;
END
$$;

-- Create accounts for existing suppliers
DO $$
DECLARE
    supp RECORD;
BEGIN
    FOR supp IN SELECT id, name FROM suppliers
    LOOP
        PERFORM create_supplier_accounts(supp.id, supp.name);
    END LOOP;
END
$$;

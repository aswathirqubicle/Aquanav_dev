import { db } from "../server/db";
import { chartOfAccounts } from "../shared/schema";

const accounts = [
  // Assets (1xxx)
  { accountCode: "1000", accountName: "Cash and Cash Equivalents", accountType: "asset", accountCategory: "current_assets", description: "Cash on hand and in banks" },
  { accountCode: "1010", accountName: "Petty Cash", accountType: "asset", accountCategory: "current_assets", description: "Small cash fund for minor expenses" },
  { accountCode: "1020", accountName: "Bank Accounts", accountType: "asset", accountCategory: "current_assets", description: "Main operating bank accounts" },
  { accountCode: "1100", accountName: "Accounts Receivable", accountType: "asset", accountCategory: "current_assets", description: "Amounts owed by customers" },
  { accountCode: "1100-C", accountName: "Customer Receivables Template", accountType: "asset", accountCategory: "current_assets", description: "Template for customer-specific receivables" },
  { accountCode: "1110", accountName: "Customer Receivables", accountType: "asset", accountCategory: "current_assets", description: "Amounts owed by customers" },
  { accountCode: "1120", accountName: "Employee Advances", accountType: "asset", accountCategory: "current_assets", description: "Advances paid to employees" },
  { accountCode: "1200", accountName: "Inventory", accountType: "asset", accountCategory: "current_assets", description: "Stock of goods for sale or use" },
  { accountCode: "1210", accountName: "Raw Materials", accountType: "asset", accountCategory: "current_assets", description: "Materials for production" },
  { accountCode: "1220", accountName: "Spare Parts", accountType: "asset", accountCategory: "current_assets", description: "Replacement parts inventory" },
  { accountCode: "1300", accountName: "Prepaid Expenses", accountType: "asset", accountCategory: "current_assets", description: "Expenses paid in advance" },
  { accountCode: "1310", accountName: "Prepaid Insurance", accountType: "asset", accountCategory: "current_assets", description: "Insurance paid in advance" },
  { accountCode: "1320", accountName: "Prepaid Rent", accountType: "asset", accountCategory: "current_assets", description: "Rent paid in advance" },
  { accountCode: "1400", accountName: "Fixed Assets", accountType: "asset", accountCategory: "fixed_assets", description: "Long-term tangible assets" },
  { accountCode: "1410", accountName: "Vessels and Boats", accountType: "asset", accountCategory: "fixed_assets", description: "Marine vessels owned" },
  { accountCode: "1420", accountName: "Machinery and Equipment", accountType: "asset", accountCategory: "fixed_assets", description: "Production machinery" },
  { accountCode: "1430", accountName: "Office Equipment", accountType: "asset", accountCategory: "fixed_assets", description: "Computers, furniture, etc." },
  { accountCode: "1440", accountName: "Vehicles", accountType: "asset", accountCategory: "fixed_assets", description: "Company vehicles" },
  { accountCode: "1450", accountName: "Buildings", accountType: "asset", accountCategory: "fixed_assets", description: "Owned buildings and facilities" },
  { accountCode: "1460", accountName: "Land", accountType: "asset", accountCategory: "fixed_assets", description: "Land owned by company" },
  { accountCode: "1500", accountName: "Accumulated Depreciation", accountType: "asset", accountCategory: "fixed_assets", description: "Total depreciation of fixed assets" },
  { accountCode: "1510", accountName: "Accum. Depreciation - Vessels", accountType: "asset", accountCategory: "fixed_assets", description: "Depreciation on vessels" },
  { accountCode: "1520", accountName: "Accum. Depreciation - Machinery", accountType: "asset", accountCategory: "fixed_assets", description: "Depreciation on machinery" },
  { accountCode: "1530", accountName: "Accum. Depreciation - Office Equipment", accountType: "asset", accountCategory: "fixed_assets", description: "Depreciation on office equipment" },
  { accountCode: "1540", accountName: "Accum. Depreciation - Vehicles", accountType: "asset", accountCategory: "fixed_assets", description: "Depreciation on vehicles" },

  // Liabilities (2xxx)
  { accountCode: "2000", accountName: "Accounts Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Amounts owed to suppliers" },
  { accountCode: "2000-S", accountName: "Supplier Payables Template", accountType: "liability", accountCategory: "current_liabilities", description: "Template for supplier-specific payables" },
  { accountCode: "2010", accountName: "Supplier Payables", accountType: "liability", accountCategory: "current_liabilities", description: "Amounts owed to suppliers" },
  { accountCode: "2020", accountName: "Accrued Expenses", accountType: "liability", accountCategory: "current_liabilities", description: "Expenses incurred but not yet paid" },
  { accountCode: "2100", accountName: "Payroll Liabilities", accountType: "liability", accountCategory: "current_liabilities", description: "Employee-related payables" },
  { accountCode: "2110", accountName: "Salary Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Salaries owed to employees" },
  { accountCode: "2120", accountName: "Tax Deducted at Source (TDS)", accountType: "liability", accountCategory: "current_liabilities", description: "Withholding taxes to be remitted" },
  { accountCode: "2130", accountName: "Employee Benefits Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Benefits owed to employees" },
  { accountCode: "2200", accountName: "Tax Liabilities", accountType: "liability", accountCategory: "current_liabilities", description: "Taxes owed to government" },
  { accountCode: "2210", accountName: "Income Tax Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Corporate income tax owed" },
  { accountCode: "2220", accountName: "VAT/GST Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Value added tax owed" },
  { accountCode: "2230", accountName: "Service Tax Payable", accountType: "liability", accountCategory: "current_liabilities", description: "Service tax owed" },
  { accountCode: "2300", accountName: "Short-term Loans", accountType: "liability", accountCategory: "current_liabilities", description: "Loans due within one year" },
  { accountCode: "2310", accountName: "Bank Overdraft", accountType: "liability", accountCategory: "current_liabilities", description: "Bank overdraft facility" },
  { accountCode: "2500", accountName: "Long-term Debt", accountType: "liability", accountCategory: "long_term_liabilities", description: "Loans due after one year" },
  { accountCode: "2510", accountName: "Bank Loans", accountType: "liability", accountCategory: "long_term_liabilities", description: "Long-term bank loans" },
  { accountCode: "2520", accountName: "Equipment Financing", accountType: "liability", accountCategory: "long_term_liabilities", description: "Financing for equipment purchases" },

  // Equity (3xxx)
  { accountCode: "3000", accountName: "Share Capital", accountType: "equity", accountCategory: "shareholders_equity", description: "Issued share capital" },
  { accountCode: "3100", accountName: "Retained Earnings", accountType: "equity", accountCategory: "shareholders_equity", description: "Accumulated profits" },
  { accountCode: "3200", accountName: "Current Year Earnings", accountType: "equity", accountCategory: "shareholders_equity", description: "Profit/loss for current year" },
  { accountCode: "3300", accountName: "Dividends", accountType: "equity", accountCategory: "shareholders_equity", description: "Distributions to shareholders" },
  { accountCode: "3400", accountName: "Owner's Drawings", accountType: "equity", accountCategory: "shareholders_equity", description: "Withdrawals by owners" },

  // Revenue (4xxx)
  { accountCode: "4000", accountName: "Operating Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Main business revenue" },
  { accountCode: "4000-P", accountName: "Project Revenue Template", accountType: "revenue", accountCategory: "operating_revenue", description: "Template for project-specific revenue" },
  { accountCode: "4010", accountName: "Marine Services Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Revenue from marine services" },
  { accountCode: "4020", accountName: "Project Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Revenue from specific projects" },
  { accountCode: "4030", accountName: "Consulting Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Revenue from consulting services" },
  { accountCode: "4040", accountName: "Equipment Rental Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Revenue from equipment rentals" },
  { accountCode: "4050", accountName: "Sales Revenue", accountType: "revenue", accountCategory: "operating_revenue", description: "Revenue from product sales" },
  { accountCode: "4060", accountName: "Commission Income", accountType: "revenue", accountCategory: "operating_revenue", description: "Income from commissions earned" },
  { accountCode: "4100", accountName: "Other Revenue", accountType: "revenue", accountCategory: "other_income", description: "Non-operating revenue" },
  { accountCode: "4110", accountName: "Interest Income", accountType: "revenue", accountCategory: "other_income", description: "Interest earned on deposits" },
  { accountCode: "4120", accountName: "Foreign Exchange Gain", accountType: "revenue", accountCategory: "other_income", description: "Gains from currency exchange" },
  { accountCode: "4130", accountName: "Miscellaneous Income", accountType: "revenue", accountCategory: "other_income", description: "Other miscellaneous income" },
  { accountCode: "4150", accountName: "Sales Returns and Allowances", accountType: "revenue", accountCategory: "operating_revenue", description: "Returns and allowances on sales" },

  // Expenses - Cost of Goods Sold (5xxx)
  { accountCode: "5000", accountName: "Cost of Goods Sold", accountType: "expense", accountCategory: "cost_of_sales", description: "Direct costs of goods sold" },
  { accountCode: "5000-P", accountName: "Project Costs Template", accountType: "expense", accountCategory: "cost_of_sales", description: "Template for project-specific costs" },
  { accountCode: "5010", accountName: "Materials Cost", accountType: "expense", accountCategory: "cost_of_sales", description: "Cost of materials used" },
  { accountCode: "5020", accountName: "Direct Labor Cost", accountType: "expense", accountCategory: "cost_of_sales", description: "Direct labor costs" },
  { accountCode: "5030", accountName: "Subcontractor Costs", accountType: "expense", accountCategory: "cost_of_sales", description: "Payments to subcontractors" },
  { accountCode: "5040", accountName: "Purchase Expense", accountType: "expense", accountCategory: "cost_of_sales", description: "General purchase expenses" },

  // Expenses - Operating Expenses (6xxx)
  { accountCode: "6000", accountName: "Operating Expenses", accountType: "expense", accountCategory: "operating_expenses", description: "General operating expenses" },
  { accountCode: "6010", accountName: "Salary Expense", accountType: "expense", accountCategory: "operating_expenses", description: "Employee salaries" },
  { accountCode: "6020", accountName: "Employee Benefits", accountType: "expense", accountCategory: "operating_expenses", description: "Employee benefits and perks" },
  { accountCode: "6030", accountName: "Rent Expense", accountType: "expense", accountCategory: "operating_expenses", description: "Office and facility rent" },
  { accountCode: "6040", accountName: "Utilities", accountType: "expense", accountCategory: "operating_expenses", description: "Electricity, water, etc." },
  { accountCode: "6050", accountName: "Insurance Expense", accountType: "expense", accountCategory: "operating_expenses", description: "Insurance premiums" },
  { accountCode: "6060", accountName: "Fuel and Transportation", accountType: "expense", accountCategory: "operating_expenses", description: "Fuel and transport costs" },
  { accountCode: "6070", accountName: "Maintenance and Repairs", accountType: "expense", accountCategory: "operating_expenses", description: "Maintenance and repair costs" },
  { accountCode: "6080", accountName: "Office Supplies", accountType: "expense", accountCategory: "operating_expenses", description: "Office supplies and materials" },
  { accountCode: "6090", accountName: "Communication Expenses", accountType: "expense", accountCategory: "operating_expenses", description: "Phone, internet, postage" },
  { accountCode: "6100", accountName: "Professional Services", accountType: "expense", accountCategory: "operating_expenses", description: "Legal, accounting, consulting fees" },
  { accountCode: "6110", accountName: "Marketing and Advertising", accountType: "expense", accountCategory: "operating_expenses", description: "Marketing and advertising costs" },
  { accountCode: "6120", accountName: "Travel and Entertainment", accountType: "expense", accountCategory: "operating_expenses", description: "Travel and entertainment expenses" },
  { accountCode: "6130", accountName: "Training and Development", accountType: "expense", accountCategory: "operating_expenses", description: "Employee training costs" },
  { accountCode: "6140", accountName: "Bank Charges", accountType: "expense", accountCategory: "operating_expenses", description: "Bank fees and charges" },
  { accountCode: "6150", accountName: "Equipment Rental", accountType: "expense", accountCategory: "operating_expenses", description: "Expenses for renting equipment" },
  { accountCode: "6200", accountName: "Administrative Expenses", accountType: "expense", accountCategory: "administrative_expenses", description: "General administrative costs" },
  { accountCode: "6210", accountName: "Management Fees", accountType: "expense", accountCategory: "administrative_expenses", description: "Management and consulting fees" },
  { accountCode: "6220", accountName: "Audit and Legal Fees", accountType: "expense", accountCategory: "administrative_expenses", description: "Audit and legal expenses" },
  { accountCode: "6230", accountName: "License and Permits", accountType: "expense", accountCategory: "administrative_expenses", description: "Business licenses and permits" },
  { accountCode: "6300", accountName: "Financial Expenses", accountType: "expense", accountCategory: "financial_expenses", description: "Financial and interest costs" },
  { accountCode: "6310", accountName: "Interest Expense", accountType: "expense", accountCategory: "financial_expenses", description: "Interest on loans and debt" },
  { accountCode: "6320", accountName: "Foreign Exchange Loss", accountType: "expense", accountCategory: "financial_expenses", description: "Losses from currency exchange" },
  { accountCode: "6330", accountName: "Bank Loan Charges", accountType: "expense", accountCategory: "financial_expenses", description: "Loan processing fees" },
  { accountCode: "6400", accountName: "Depreciation Expense", accountType: "expense", accountCategory: "depreciation", description: "Depreciation of fixed assets" },
  { accountCode: "6410", accountName: "Depreciation - Vessels", accountType: "expense", accountCategory: "depreciation", description: "Depreciation on vessels" },
  { accountCode: "6420", accountName: "Depreciation - Machinery", accountType: "expense", accountCategory: "depreciation", description: "Depreciation on machinery" },
  { accountCode: "6430", accountName: "Depreciation - Office Equipment", accountType: "expense", accountCategory: "depreciation", description: "Depreciation on office equipment" },
  { accountCode: "6440", accountName: "Depreciation - Vehicles", accountType: "expense", accountCategory: "depreciation", description: "Depreciation on vehicles" },
  { accountCode: "6500", accountName: "Tax Expenses", accountType: "expense", accountCategory: "tax_expenses", description: "Tax-related expenses" },
  { accountCode: "6510", accountName: "Income Tax Expense", accountType: "expense", accountCategory: "tax_expenses", description: "Corporate income tax expense" },
  { accountCode: "6520", accountName: "VAT/GST Expense", accountType: "expense", accountCategory: "tax_expenses", description: "Non-recoverable VAT/GST" },
  { accountCode: "6530", accountName: "Property Tax", accountType: "expense", accountCategory: "tax_expenses", description: "Property and real estate tax" },
];

async function seedChartOfAccounts() {
  console.log("Seeding Chart of Accounts...");
  
  for (const account of accounts) {
    try {
      await db
        .insert(chartOfAccounts)
        .values({
          ...account,
          isActive: true,
        })
        .onConflictDoNothing();
    } catch (error: any) {
      if (!error.message?.includes("duplicate key")) {
        console.error(`Error inserting account ${account.accountCode}:`, error.message);
      }
    }
  }
  
  console.log(`Chart of Accounts seeding complete. ${accounts.length} accounts processed.`);
}

seedChartOfAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });

# Aquanav ERP - Marine Project Management System

## Overview
Aquanav ERP is a comprehensive business productivity platform designed for marine construction projects. Its primary purpose is to streamline operations through advanced financial management, project tracking, and asset management capabilities. The platform aims to be a complete solution for marine businesses, offering robust tools for managing sales, purchases, payroll, and a distinct asset inventory.

## User Preferences
- Simple, professional communication without excessive technical details
- Focus on functional business requirements over technical implementation
- Prefer comprehensive solutions that address complete workflows
- Asset inventory must remain separate from existing inventory module

## System Architecture
The system is built as a full-stack application.
-   **UI/UX Decisions**: The frontend utilizes React with TypeScript, Vite, Tailwind CSS, and shadcn/ui components for a modern and responsive user interface. Purchase orders and invoices feature a modern card-based layout with print functionality.
-   **Technical Implementations**:
    *   **Authentication**: Secure, session-based, role-based access control (admin, project_manager, finance, employee, customer).
    *   **Financials**: Features a double-entry bookkeeping system with balance verification, comprehensive financial reporting (general ledger, profit/loss), and a complete payroll system with approval workflows.
    *   **Sales & Purchases**: Includes a full sales workflow (quotations, invoices, credit notes) and a purchase management system (request-to-payment with approvals). Sales invoices require admin approval before posting to the general ledger. Purchase module supports both product items (from inventory) and service items (custom descriptions with pricing) for requests, orders, and invoices. Both purchase orders and invoices display payment terms, bank account details, and notes. Invoice items table includes tax column and properly displays both product and service items. Purchase invoice view is fully responsive for mobile, tablet, and desktop. Statistics display only approved invoices (total count, amount, pending, overdue) with a separate count for pending approval invoices. Purchase invoices can be optionally linked to projects or asset instances: when linked to a project and approved, the invoice amount is automatically added to the project's actual cost; when linked to an asset instance and approved, a maintenance record is created with the invoice cost. Purchase invoice details view displays linked project name or asset instance information (tag and type) with visual badges and explanatory text. Project and asset instance fields use Autocomplete components for better searchability.
    *   **Asset Management**: A distinct asset inventory system tracks unique serial numbers and barcodes. It supports asset types, individual instances with lifecycle tracking (status, condition, location, assignments), and maintenance scheduling. Asset assignments feature monthly rental rates with pro-rated cost calculations.
    *   **Employee Management**: Comprehensive employee master data, multi-country visa support (document-based), safety equipment tracking, training records with expiry, employee grading, and UAE-compliant contract generation.
    *   **VAT & Multi-Currency**: Integrated UAE VAT compliance for customers and suppliers, and a multi-currency system with AED as the default, including exchange rate management.
-   **System Design Choices**:
    *   **Modular Design**: Separation of concerns between frontend, backend, and database layers.
    *   **Data Integrity**: Enforced unique constraints for asset serial numbers and barcodes.
    *   **Workflow Automation**: Approval workflows for sales invoices and purchase requests.
    *   **Print Support**: Purchase orders and invoices include browser-native print functionality with optimized print styles.

## External Dependencies
-   **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, Wouter (for routing), TanStack Query (for server state management).
-   **Backend**: Express.js.
-   **Database**: PostgreSQL with Drizzle ORM.
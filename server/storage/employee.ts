import { SupplierStorage } from "./supplier";
import {
  Company,
  Customer,
  Employee,
  EmployeeDocument,
  EmployeeFeedback,
  EmployeeNextOfKin,
  EmployeeTrainingRecord,
  InsertEmployee,
  InsertEmployeeDocument,
  InsertEmployeeFeedback,
  InsertEmployeeNextOfKin,
  InsertEmployeeTrainingRecord,
  Project,
  employeeDocuments,
  employeeFeedback,
  employeeNextOfKin,
  employeeTrainingRecords,
  employees,
  projects,
  suppliers,
  users,
} from "@shared/schema";
import {
  and,
  desc,
  eq,
  isNotNull,
  lte,
  or,
} from "drizzle-orm";
import { db } from "../db";
import {
  generateCommonFooter,
  generateCommonHeader,
  getCommonStyles,
} from "../document-utils";

export class EmployeeStorage extends SupplierStorage {
  // Employee methods
  async getEmployees(): Promise<Employee[]> {
    try {
      return await db.select().from(employees);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getEmployees: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployees",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    try {
      const result = await db
        .insert(employees)
        .values(employeeData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployee: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployee(
    id: number,
    employeeData: Partial<InsertEmployee>,
  ): Promise<Employee | undefined> {
    try {
      const result = await db
        .update(employees)
        .set(employeeData)
        .where(eq(employees.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployee (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    try {
      const result = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id));
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployee (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Next of Kin methods
  async getEmployeeNextOfKin(employeeId: number): Promise<EmployeeNextOfKin[]> {
    try {
      return await db
        .select()
        .from(employeeNextOfKin)
        .where(eq(employeeNextOfKin.employeeId, employeeId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeNextOfKin (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeNextOfKin(
    data: InsertEmployeeNextOfKin,
  ): Promise<EmployeeNextOfKin> {
    try {
      const result = await db
        .insert(employeeNextOfKin)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployeeNextOfKin: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeNextOfKin(
    id: number,
    data: Partial<InsertEmployeeNextOfKin>,
  ): Promise<EmployeeNextOfKin | undefined> {
    try {
      const result = await db
        .update(employeeNextOfKin)
        .set(data)
        .where(eq(employeeNextOfKin.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeNextOfKin (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeNextOfKin(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeNextOfKin)
        .where(eq(employeeNextOfKin.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeNextOfKin (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Training Records methods
  async getEmployeeTrainingRecord(
    id: number,
  ): Promise<EmployeeTrainingRecord | undefined> {
    try {
      const result = await db
        .select()
        .from(employeeTrainingRecords)
        .where(eq(employeeTrainingRecords.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeTrainingRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async getEmployeeTrainingRecords(
    employeeId: number,
  ): Promise<EmployeeTrainingRecord[]> {
    try {
      return await db
        .select()
        .from(employeeTrainingRecords)
        .where(eq(employeeTrainingRecords.employeeId, employeeId))
        .orderBy(desc(employeeTrainingRecords.trainingDate));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeTrainingRecords (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeTrainingRecords",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeTrainingRecord(
    data: InsertEmployeeTrainingRecord,
  ): Promise<EmployeeTrainingRecord> {
    console.log(data);
    try {
      const normalizedData = {
        ...data,
        trainingDate:
          data.trainingDate instanceof Date
            ? data.trainingDate.toISOString().split("T")[0]
            : data.trainingDate,

        expiryDate:
          data.expiryDate instanceof Date
            ? data.expiryDate.toISOString().split("T")[0]
            : (data.expiryDate ?? null),
      };
      const result = await db
        .insert(employeeTrainingRecords)
        .values(normalizedData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployeeTrainingRecord: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeTrainingRecord(
    id: number,
    data: Partial<InsertEmployeeTrainingRecord>,
  ): Promise<EmployeeTrainingRecord | undefined> {
    try {
      const normalizedData = {
        ...data,
        trainingDate:
          data.trainingDate instanceof Date
            ? data.trainingDate.toISOString().split("T")[0]
            : data.trainingDate,
        expiryDate:
          data.expiryDate instanceof Date
            ? data.expiryDate.toISOString().split("T")[0]
            : data.expiryDate,
      };

      const result = await db
        .update(employeeTrainingRecords)
        .set(normalizedData)
        .where(eq(employeeTrainingRecords.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeTrainingRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeTrainingRecord(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeTrainingRecords)
        .where(eq(employeeTrainingRecords.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeTrainingRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async getExpiringDocuments(daysAhead: number = 30): Promise<{
    visas: Array<
      Employee & {
        documentType: string;
        expiryDate: string;
        daysToExpiry: number;
      }
    >;
    trainings: Array<
      EmployeeTrainingRecord & { employee: Employee; daysToExpiry: number }
    >;
  }> {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      // Get expiring visas
      const employeesWithExpiringVisas = await db
        .select()
        .from(employees)
        .where(
          or(
            and(
              eq(employees.usVisaStatus, "valid"),
              lte(
                employees.usVisaExpiryDate,
                targetDate.toISOString().split("T")[0],
              ),
            ),
            and(
              eq(employees.schengenVisaStatus, "valid"),
              lte(
                employees.schengenVisaExpiryDate,
                targetDate.toISOString().split("T")[0],
              ),
            ),
          ),
        );

      // Get expiring training records
      const expiringTrainings = await db
        .select({
          training: employeeTrainingRecords,
          employee: employees,
        })
        .from(employeeTrainingRecords)
        .leftJoin(
          employees,
          eq(employeeTrainingRecords.employeeId, employees.id),
        )
        .where(
          and(
            eq(employeeTrainingRecords.status, "active"),
            isNotNull(employeeTrainingRecords.expiryDate),
            lte(
              employeeTrainingRecords.expiryDate,
              targetDate.toISOString().split("T")[0],
            ),
          ),
        );

      // Transform data to include days to expiry
      const visas = employeesWithExpiringVisas.flatMap((emp) => {
        const results = [];
        if (emp.usVisaStatus === "valid" && emp.usVisaExpiryDate) {
          const daysToExpiry = Math.ceil(
            (new Date(emp.usVisaExpiryDate).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );
          results.push({
            ...emp,
            documentType: "US Visa",
            expiryDate: emp.usVisaExpiryDate,
            daysToExpiry,
          });
        }
        if (emp.schengenVisaStatus === "valid" && emp.schengenVisaExpiryDate) {
          const daysToExpiry = Math.ceil(
            (new Date(emp.schengenVisaExpiryDate).getTime() -
              new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );
          results.push({
            ...emp,
            documentType: "Schengen Visa",
            expiryDate: emp.schengenVisaExpiryDate,
            daysToExpiry,
          });
        }
        return results;
      });

      const trainings = expiringTrainings.map(({ training, employee }) => {
        const daysToExpiry = Math.ceil(
          (new Date(training.expiryDate!).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return {
          ...training,
          employee: employee!,
          daysToExpiry,
        };
      });

      return { visas, trainings };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getExpiringDocuments: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getExpiringDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async generateEmploymentContract(employeeId: number): Promise<string> {
    try {
      const employee = await this.getEmployee(employeeId);
      if (!employee) {
        throw new Error("Employee not found");
      }

      const company = await this.getCompany();
      const companyName = company?.name || "Aquanav Maritime Services L.L.C";

      const now = new Date();
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthName = monthNames[now.getMonth()];
      const year = now.getFullYear();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")} ${monthName} ${year}`;

      const referenceNo = `EMPCON/${employee.employeeCode}/${monthName} ${year}`;

      const contractTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Employment Agreement - ${employee.firstName} ${employee.lastName}</title>
    ${getCommonStyles()}
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .print-layout {
            width: 100%;
            border-collapse: collapse;
            border: none;
        }
        .header-spacer {
            height: 45mm;
            display: block;
        }
        .footer-spacer {
            height: 35mm;
            display: block;
        }
        .container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 0;
        }
        .page-content {
            padding: 10px 60px;
            text-align: justify;
            font-size: 15px;
        }
        .contract-header {
            margin-bottom: 25px;
        }
        .ref-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .employee-details {
            margin-bottom: 20px;
        }
        .salutation {
            margin-bottom: 15px;
        }
        ol {
            padding-left: 20px;
        }
        ol li {
            margin-bottom: 12px;
            padding-left: 5px;
        }
        .sub-list {
            list-style-type: lower-alpha;
            margin-top: 8px;
        }
        .sub-list li {
            margin-bottom: 4px;
        }
        .signature-block {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
        }
        .signature-box {
            width: 45%;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
        }
        .no-print {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
        .print-btn {
            padding: 10px 20px;
            background-color: #0b4d78;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .print-btn:hover {
            background-color: #083a5a;
        }
        @media print {
            .no-print {
                display: none;
            }
            body {
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: none;
                margin: 0;
                padding: 0;
            }
            .page-content {
                padding-top: 0;
                padding-bottom: 0;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
            }
            table {
                page-break-inside: auto;
            }
            tr {
                page-break-inside: auto;
            }
            td {
                page-break-inside: auto;
            }
            thead {
                display: table-header-group;
            }
            tfoot {
                display: table-footer-group;
            }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button class="print-btn" onclick="window.print()">Print Agreement</button>
    </div>

    ${generateCommonHeader({ company })}
    ${generateCommonFooter({ company })}

    <table class="print-layout">
        <thead>
            <tr>
                <td style="border: none;">
                    <div class="header-spacer"></div>
                </td>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: none;">
                    <div class="container">
                        <div class="page-content">
                            <div class="contract-header">
                                <h2 style="text-align: center; text-decoration: underline; color: #0b4d78;">LETTER OF EMPLOYMENT</h2>
                                <div class="ref-row">
                                    <span><strong>${formattedDate}</strong></span>
                                    <span>Ref: <strong>${referenceNo}</strong></span>
                                </div>
                            </div>

                            <div class="employee-details">
                                <strong>Mr. ${employee.firstName} ${employee.lastName}</strong><br>
                                <span style="white-space: pre-wrap;"><strong>${employee.address || "-"}</strong></span>
                            </div>

                            <div class="salutation">
                                Dear <strong>${employee.firstName}</strong>,
                            </div>

                            <div class="intro-text">
                                <p>We are pleased to employ you as "<strong>${employee.position || "Coating Repair technician"}</strong>" in our organization on the following terms and conditions, for a period of 2 years from the date of this letter. Contract will be reviewed and extended every 2 years. Your employee number is <strong>${employee.employeeCode}</strong>.</p>
                            </div>

                            <ol>
                                <li>Your contract period onboard a vessel shall be for around 5–7 months basis each project scope per vessel, which can be extended further or terminated earlier as the project demands.</li>
                                
                                <li>This employment contract will be supplemented by the Seafarers Employment Agreement (SEA) signed between the RPSL Company and yourself, issued for the specific project/vessel, which will be governed as per CBA.</li>
                                
                                <li>You will be paid contractual gross salary on monthly basis as remuneration as per Aquanav’s salary matrix basis your employee grade, solely during the period of each project onboard the ship. You will be employed with Aquanav as a <strong>Grade ${employee.grade || "1"}</strong> employee, with a Gross monthly salary of <strong>${employee.contractSalary ? parseFloat(employee.contractSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (employee.contractCurrency || "AED") : employee.salary ? parseFloat(employee.salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED" : "450.00 USD"}</strong>, before deductions.</li>
                                
                                <li>Your present place of work will be onboard the assigned vessel, but during the above assignment you shall be liable to be posted/transferred anywhere to serve any of the Company’s Projects, at the sole discretion of the Management.</li>
                                
                                <li>You will not (except in the normal course of the Company's business) disclose, divulge or publish any article or statement, deliver any lecture, or broadcast or make any communication to the press, including magazine publication, technical information relating to the Company’s products or to any matter with which the Company may be concerned, unless you have previously applied to and obtained the written permission from the Company.</li>
                                
                                <li>You will be required to maintain utmost secrecy in respect of Project documents, commercial offer, design, documents, Project cost & Estimation, Technology, Software packages license, company’s policies, Company’s patterns & Trademark and company’s Human assets profile.</li>
                                
                                <li>You will be required to comply with all such rules and regulations as the Company may frame from time to time.</li>
                                
                                <li>During the period of engagement, if you are found non-performing or guilty of fraud, dishonest, disobedience, disorderly behavior, negligence, indiscipline, absence from duty without permission or any other conduct considered as deterrent to Aquanav’s interest or violation of one or more terms of this letter, your services may be terminated without notice, and on account of reason of any of the acts or omission the company shall be entitled to recover the damages from you.</li>

                                <li>Aquanav has invested and will continue to impart professional certification programs to enhance your professional competence and will continue to do so. You are to serve Aquanav for a period of 2 years or 3 projects, whichever is more, from the date of completion of the most recent certification program. Pro-rata deduction will apply and be deducted from your corpus, in case of departure before completion of the above mentioned time period.</li>
                                
                                <li>You will not accept any present, commission or any sort of gratification in cash or kind from any person, party or firm or Company having serving as Clients, suppliers or vendors of Aquanav. If you are offered any such gratification, you should immediately report the same to the Aquanav Management.</li>
                                
                                <li>You will be responsible for safekeeping and return in good condition and order of all Company property, which may be in your use, custody, or charge.</li>
                                
                                <li>Your promotion and growth in the organization will be evaluated on a yearly basis to qualify as per the Employee Grading Matrix of Aquanav, taking the following factors into consideration in order of priority. Grading matrix enclosed for reference.
                                    <ol class="sub-list">
                                        <li>Evaluation of work quality as per PSPC / NACE requirements, to provide work guarantee to clients. Evaluation will be done by a shore based coating expert from time to time.</li>
                                        <li>Timely work completion and delivery of the project, as estimated during project commencement.</li>
                                        <li>Customer feedback – As received from onboard Master and/or Superintendent.</li>
                                        <li>Discipline and integrity – Upholding values and executing service requirements of Aquanav, as communicated from time to time.</li>
                                        <li>Completion of training programs as per training requirements of Aquanav.</li>
                                    </ol>
                                </li>
                                
                                <li>You will be covered under an insurance program during your period of engagement onboard the ship, for shore medical treatment, disabilities, repatriation and mortality.</li>
                                
                                <li>You agree to the deduction of 5% of your monthly salary that will be invested in a fixed deposit scheme, for your future welfare and security. Up to 60% of this corpus may be availed by you after 2 years of service for any of your personal needs. The deduction would continue during your period of stay in the organization. The corpus will be refunded as per contract terms upon your exit from Aquanav.</li>
                                
                                <li>Please sign the declaration as having read, understood and accepted the terms and conditions.</li>
                            </ol>

                            <p>We welcome you to Aquanav family and look forward to a fruitful association.</p>
                            
                            <p>With best wishes,</p>

                            <div class="signature-block">
                                <div class="signature-box">
                                    <p>For and on behalf of<br><strong>Aquanav Maritime Services L.L.C</strong></p>
                                    <div class="signature-line">
                                        Deepak Sasikumar<br>
                                        Managing Director
                                    </div>
                                </div>
                                <div class="signature-box">
                                    <p>Accepted and Agreed by<br><strong>Employee</strong></p>
                                    <div class="signature-line">
                                        <strong>${employee.firstName} ${employee.lastName}</strong><br>
                                        Employee No: <strong>${employee.employeeCode}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
        <tfoot>
            <tr>
                <td style="border: none;">
                    <div class="footer-spacer"></div>
                </td>
            </tr>
        </tfoot>
    </table>
</body>
</html>
      `;

      return contractTemplate;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in generateEmploymentContract (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "generateEmploymentContract",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Documents CRUD operations
  async getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]> {
    try {
      return await db
        .select()
        .from(employeeDocuments)
        .where(eq(employeeDocuments.employeeId, employeeId))
        .orderBy(desc(employeeDocuments.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeDocuments (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeDocument(
    data: InsertEmployeeDocument,
  ): Promise<EmployeeDocument> {
    try {
      const result = await db
        .insert(employeeDocuments)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createEmployeeDocument: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeDocument(
    id: number,
    data: Partial<InsertEmployeeDocument>,
  ): Promise<EmployeeDocument | null> {
    try {
      const result = await db
        .update(employeeDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeDocuments.id, id))
        .returning();
      return result[0] || null;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeDocuments)
        .where(eq(employeeDocuments.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async getExpiringEmployeeDocuments(
    daysAhead: number = 30,
  ): Promise<
    Array<EmployeeDocument & { employee: Employee; daysToExpiry: number }>
  > {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      const result = await db
        .select({
          document: employeeDocuments,
          employee: employees,
        })
        .from(employeeDocuments)
        .leftJoin(employees, eq(employeeDocuments.employeeId, employees.id))
        .where(
          and(
            eq(employeeDocuments.status, "active"),
            or(
              lte(
                employeeDocuments.expiryDate,
                targetDate.toISOString().split("T")[0],
              ),
              lte(
                employeeDocuments.validTill,
                targetDate.toISOString().split("T")[0],
              ),
            ),
          ),
        );

      return result.map(({ document, employee }) => {
        const expiryDate = document.expiryDate || document.validTill;
        const daysToExpiry = expiryDate
          ? Math.ceil(
              (new Date(expiryDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;
        return {
          ...document,
          employee: employee!,
          daysToExpiry,
        };
      });
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getExpiringEmployeeDocuments: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getExpiringEmployeeDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
    try {
      const result = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeByUserId (userId: ${userId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeByUserId",
        severity: "error",
      });
      throw error;
    }
  }

  async getEmployeeFeedback(employeeId: number): Promise<any[]> {
    const results = await db
      .select({
        id: employeeFeedback.id,
        employeeId: employeeFeedback.employeeId,
        projectId: employeeFeedback.projectId,
        feedback: employeeFeedback.feedback,
        createdById: employeeFeedback.createdById,
        createdAt: employeeFeedback.createdAt,
        updatedAt: employeeFeedback.updatedAt,
        createdByUsername: users.username,
        projectTitle: projects.title,
      })
      .from(employeeFeedback)
      .leftJoin(users, eq(employeeFeedback.createdById, users.id))
      .leftJoin(projects, eq(employeeFeedback.projectId, projects.id))
      .where(eq(employeeFeedback.employeeId, employeeId))
      .orderBy(desc(employeeFeedback.createdAt));
    return results;
  }

  async createEmployeeFeedback(
    data: InsertEmployeeFeedback,
  ): Promise<EmployeeFeedback> {
    const [result] = await db.insert(employeeFeedback).values(data).returning();
    return result;
  }

  async updateEmployeeFeedback(
    id: number,
    data: { feedback: string; projectId: number | null },
  ): Promise<EmployeeFeedback | undefined> {
    const [result] = await db
      .update(employeeFeedback)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeFeedback.id, id))
      .returning();
    return result;
  }

  async deleteEmployeeFeedback(id: number): Promise<boolean> {
    const result = await db
      .delete(employeeFeedback)
      .where(eq(employeeFeedback.id, id))
      .returning();
    return result.length > 0;
  }

  async getEmployeeFeedbackById(
    id: number,
  ): Promise<EmployeeFeedback | undefined> {
    const [result] = await db
      .select()
      .from(employeeFeedback)
      .where(eq(employeeFeedback.id, id));
    return result;
  }
}

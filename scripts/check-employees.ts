
import { db } from "../server/db";
import { employees } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkActiveEmployees() {
  try {
    console.log("Checking active employees...");
    
    const activeEmployees = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
        category: employees.category,
        salary: employees.salary,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(eq(employees.isActive, true));

    console.log(`Found ${activeEmployees.length} active employees:`);
    
    if (activeEmployees.length === 0) {
      console.log("❌ No active employees found. You need to add employees before generating payroll.");
      console.log("Go to the Employees page and add some employees first.");
    } else {
      console.log("✅ Active employees found:");
      activeEmployees.forEach((emp, index) => {
        console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.category} - $${emp.salary}`);
      });
    }

    // Check all employees (including inactive)
    const allEmployees = await db.select().from(employees);
    console.log(`\nTotal employees in database: ${allEmployees.length}`);
    
    const inactiveCount = allEmployees.filter(emp => !emp.isActive).length;
    if (inactiveCount > 0) {
      console.log(`Inactive employees: ${inactiveCount}`);
    }

  } catch (error) {
    console.error("Error checking employees:", error);
  } finally {
    process.exit(0);
  }
}

checkActiveEmployees();

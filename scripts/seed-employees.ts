
import { db } from '../server/db';
import * as schema from '../shared/schema';

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra',
  'Donald', 'Donna', 'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah', 'Timothy', 'Dorothy'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const positions = [
  'Marine Engineer', 'Deck Officer', 'Chief Engineer', 'Navigation Officer', 'Safety Officer',
  'Welding Specialist', 'Hull Inspector', 'Crane Operator', 'Project Manager', 'Quality Controller',
  'Electrical Technician', 'Mechanical Technician', 'Paint Specialist', 'Rigging Specialist', 'Fitter',
  'Machinist', 'Pipefitter', 'Carpenter', 'Boilermaker', 'Sheet Metal Worker',
  'Administrative Assistant', 'Procurement Officer', 'Logistics Coordinator', 'Finance Officer', 'HR Specialist',
  'Site Supervisor', 'Safety Inspector', 'Documentation Officer', 'Inventory Controller', 'Equipment Operator',
  'Maintenance Technician', 'Workshop Supervisor', 'Planning Engineer', 'Cost Controller', 'Field Engineer',
  'Marine Surveyor', 'Port Captain', 'Operations Manager', 'Materials Handler', 'Security Officer'
];

const departments = [
  'Engineering', 'Operations', 'Marine Services', 'Safety & Quality', 'Administration',
  'Finance', 'Human Resources', 'Procurement', 'Logistics', 'Maintenance',
  'Project Management', 'Technical Services', 'Security'
];

const categories = ['permanent', 'consultant', 'contract'];

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1-${areaCode}-${exchange}-${number}`;
}

function generateSalary(): string {
  // Generate salaries between $35,000 and $120,000
  const salary = Math.floor(Math.random() * 85000) + 35000;
  return salary.toString();
}

function generateHireDate(): Date {
  // Generate hire dates within the last 5 years
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, 0, 1);
  const randomTime = fiveYearsAgo.getTime() + Math.random() * (now.getTime() - fiveYearsAgo.getTime());
  return new Date(randomTime);
}

async function seedEmployees() {
  console.log('Starting to seed 50 employees...');

  // Get existing employee codes to avoid duplicates
  const existingEmployees = await db.select({ employeeCode: schema.employees.employeeCode }).from(schema.employees);
  const existingCodes = new Set(existingEmployees.map(emp => emp.employeeCode));

  // Generate employee code
  function generateEmployeeCode(index: number): string {
    let code;
    let counter = index + 1;
    do {
      code = `EMP${counter.toString().padStart(3, '0')}`;
      counter++;
    } while (existingCodes.has(code));
    existingCodes.add(code);
    return code;
  }

  const employees = [];
  for (let i = 0; i < 50; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const position = positions[i % positions.length];
    const department = departments[i % departments.length];
    const category = categories[i % categories.length];
    
    employees.push({
      employeeCode: generateEmployeeCode(i),
      firstName: firstName,
      lastName: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@company.com`,
      phone: generatePhoneNumber(),
      position: position,
      department: department,
      category: category,
      salary: generateSalary(),
      hireDate: generateHireDate(),
      isActive: Math.random() > 0.1, // 90% active employees
      userId: null
    });
  }

  try {
    // Insert employees in batches of 10
    console.log('Inserting employees...');
    for (let i = 0; i < employees.length; i += 10) {
      const batch = employees.slice(i, i + 10);
      await db.insert(schema.employees).values(batch);
      console.log(`Inserted employees ${i + 1} to ${Math.min(i + 10, employees.length)}`);
    }

    console.log('✓ Successfully seeded 50 employees!');
  } catch (error) {
    console.error('Error seeding employees:', error);
    throw error;
  }
}

// Run the seeding function
seedEmployees()
  .then(() => {
    console.log('Employee seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Employee seeding failed:', error);
    process.exit(1);
  });

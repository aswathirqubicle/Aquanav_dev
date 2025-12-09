
import { db } from '../server/db';
import * as schema from '../shared/schema';

async function seedAssetAssignments() {
  console.log('Starting to seed asset assignments...');

  try {
    // Get existing projects and assets
    const projects = await db.select().from(schema.projects);
    const assets = await db.select().from(schema.assets);

    if (projects.length === 0) {
      console.log('No projects found. Please create some projects first.');
      return;
    }

    if (assets.length === 0) {
      console.log('No assets found. Please create some assets first.');
      return;
    }

    console.log(`Found ${projects.length} projects and ${assets.length} assets`);

    // Clear existing assignments
    await db.delete(schema.projectAssetAssignments);
    console.log('Cleared existing asset assignments');

    const assignments = [];
    let assignmentCount = 0;

    // Assign assets to projects with realistic scenarios
    for (const project of projects) {
      // Get project dates
      const projectStartDate = project.startDate ? new Date(project.startDate) : new Date();
      const projectEndDate = project.plannedEndDate ? new Date(project.plannedEndDate) : 
        new Date(projectStartDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

      // Randomly assign 1-3 assets per project
      const numAssetsToAssign = Math.floor(Math.random() * 3) + 1;
      const availableAssets = [...assets];
      
      for (let i = 0; i < numAssetsToAssign && availableAssets.length > 0; i++) {
        // Pick a random asset
        const assetIndex = Math.floor(Math.random() * availableAssets.length);
        const asset = availableAssets.splice(assetIndex, 1)[0];

        // Generate assignment dates within project timeline
        const assignmentStart = new Date(projectStartDate.getTime() + 
          Math.random() * (projectEndDate.getTime() - projectStartDate.getTime()) * 0.3);
        
        const assignmentDuration = Math.floor(Math.random() * 20) + 5; // 5-25 days
        const assignmentEnd = new Date(assignmentStart.getTime() + assignmentDuration * 24 * 60 * 60 * 1000);

        // Ensure assignment end doesn't exceed project end
        if (assignmentEnd > projectEndDate) {
          assignmentEnd.setTime(projectEndDate.getTime());
        }

        // Calculate costs
        const dailyRate = asset.dailyRentalAmount ? parseFloat(asset.dailyRentalAmount) : 100;
        const totalDays = Math.ceil((assignmentEnd.getTime() - assignmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalCost = dailyRate * totalDays;

        assignments.push({
          projectId: project.id,
          assetId: asset.id,
          startDate: assignmentStart,
          endDate: assignmentEnd,
          dailyRate: dailyRate.toString(),
          totalCost: totalCost.toString(),
          assignedAt: new Date(),
          assignedBy: 1, // Admin user
        });

        assignmentCount++;
        console.log(`Assignment ${assignmentCount}: ${asset.name} to ${project.title}`);
        console.log(`  Duration: ${assignmentStart.toDateString()} to ${assignmentEnd.toDateString()}`);
        console.log(`  Daily Rate: $${dailyRate}, Total Cost: $${totalCost.toFixed(2)}`);
      }
    }

    // Insert assignments in batches
    if (assignments.length > 0) {
      console.log(`\nInserting ${assignments.length} asset assignments...`);
      
      for (let i = 0; i < assignments.length; i += 5) {
        const batch = assignments.slice(i, i + 5);
        await db.insert(schema.projectAssetAssignments).values(batch);
        console.log(`Inserted assignments ${i + 1} to ${Math.min(i + 5, assignments.length)}`);
      }

      console.log('✓ Successfully seeded asset assignments!');

      // Display summary
      console.log('\n=== Assignment Summary ===');
      for (const project of projects) {
        const projectAssignments = assignments.filter(a => a.projectId === project.id);
        if (projectAssignments.length > 0) {
          const totalProjectAssetCost = projectAssignments.reduce((sum, a) => sum + parseFloat(a.totalCost), 0);
          console.log(`${project.title}: ${projectAssignments.length} assets, Total Cost: $${totalProjectAssetCost.toFixed(2)}`);
        }
      }

      const grandTotal = assignments.reduce((sum, a) => sum + parseFloat(a.totalCost), 0);
      console.log(`\nGrand Total Asset Rental Cost: $${grandTotal.toFixed(2)}`);
    } else {
      console.log('No assignments were created.');
    }

  } catch (error) {
    console.error('Error seeding asset assignments:', error);
    throw error;
  }
}

// Also create some additional mock assets if needed
async function createMockAssets() {
  console.log('Creating additional mock assets...');

  const mockAssets = [
    {
      name: "Portable Crane",
      barcode: "CR001",
      category: "Heavy Equipment",
      description: "5-ton portable crane for lifting operations",
      status: "available",
      acquisitionDate: new Date('2023-01-15'),
      acquisitionCost: "75000.00",
      dailyRentalAmount: "250.00"
    },
    {
      name: "Welding Machine",
      barcode: "WM002",
      category: "Tools",
      description: "Industrial welding machine for metal fabrication",
      status: "available",
      acquisitionDate: new Date('2023-03-20'),
      acquisitionCost: "15000.00",
      dailyRentalAmount: "75.00"
    },
    {
      name: "Pressure Washer",
      barcode: "PW003",
      category: "Cleaning Equipment",
      description: "High-pressure washer for surface cleaning",
      status: "available",
      acquisitionDate: new Date('2023-05-10'),
      acquisitionCost: "3500.00",
      dailyRentalAmount: "45.00"
    },
    {
      name: "Scaffolding System",
      barcode: "SC004",
      category: "Support Equipment",
      description: "Modular scaffolding system for access",
      status: "available",
      acquisitionDate: new Date('2023-02-28'),
      acquisitionCost: "25000.00",
      dailyRentalAmount: "120.00"
    },
    {
      name: "Generator",
      barcode: "GN005",
      category: "Power Equipment",
      description: "50kW diesel generator for power supply",
      status: "available",
      acquisitionDate: new Date('2023-04-15'),
      acquisitionCost: "35000.00",
      dailyRentalAmount: "180.00"
    },
    {
      name: "Air Compressor",
      barcode: "AC006",
      category: "Tools",
      description: "Industrial air compressor for pneumatic tools",
      status: "available",
      acquisitionDate: new Date('2023-06-01'),
      acquisitionCost: "8000.00",
      dailyRentalAmount: "60.00"
    }
  ];

  try {
    // Check which assets already exist
    const existingAssets = await db.select({ barcode: schema.assets.barcode }).from(schema.assets);
    const existingBarcodes = new Set(existingAssets.map(a => a.barcode));

    const newAssets = mockAssets.filter(asset => !existingBarcodes.has(asset.barcode));

    if (newAssets.length > 0) {
      await db.insert(schema.assets).values(newAssets);
      console.log(`✓ Created ${newAssets.length} new mock assets`);
    } else {
      console.log('All mock assets already exist');
    }
  } catch (error) {
    console.error('Error creating mock assets:', error);
    throw error;
  }
}

// Run both functions
async function seedAll() {
  try {
    await createMockAssets();
    await seedAssetAssignments();
    console.log('\n✓ Asset seeding completed successfully!');
  } catch (error) {
    console.error('Asset seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
seedAll()
  .then(() => {
    console.log('Asset and assignment seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Asset and assignment seeding failed:', error);
    process.exit(1);
  });

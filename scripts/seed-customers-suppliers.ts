
import { db } from '../server/db';
import * as schema from '../shared/schema';

const sampleCompanyNames = [
  'Atlantic Shipping Co.', 'Pacific Marine Services', 'Coastal Transport Ltd.', 'Harbor Logistics Inc.',
  'Ocean Freight Solutions', 'Maritime Cargo Systems', 'Blue Water Shipping', 'Deep Sea Logistics',
  'Port Authority Services', 'Marine Transport Corp.', 'Seafarer Shipping Lines', 'Anchor Bay Marine',
  'Tidal Wave Logistics', 'Compass Rose Shipping', 'Starboard Marine Services', 'Lighthouse Cargo',
  'Nautical Solutions Inc.', 'Windward Shipping', 'Seaport Logistics', 'Mariner Transport',
  'Offshore Marine Corp.', 'Dockside Services', 'Voyager Shipping Lines', 'Neptune Marine Solutions',
  'Poseidon Cargo Services', 'Kraken Shipping Co.', 'Leviathan Marine', 'Triton Transport',
  'Siren Logistics', 'Mermaid Marine Services', 'Coral Reef Shipping', 'Barnacle Bay Transport',
  'Seaweed Solutions', 'Kelp Forest Marine', 'Tide Pool Logistics', 'Wave Crest Shipping',
  'Storm Surge Transport', 'Calm Waters Marine', 'Rough Seas Logistics', 'Smooth Sailing Corp.',
  'High Tide Services', 'Low Tide Transport', 'Spring Tide Marine', 'Neap Tide Shipping',
  'Current Flow Logistics', 'Gulf Stream Transport', 'Jetstream Marine', 'Trade Winds Shipping',
  'Monsoon Logistics', 'Hurricane Marine Services', 'Typhoon Transport', 'Cyclone Shipping Co.'
];

const supplierNames = [
  'Marine Parts Supply Co.', 'Nautical Equipment Ltd.', 'Ship Components Inc.', 'Ocean Tools Supply',
  'Maritime Hardware Store', 'Deck Equipment Co.', 'Engine Parts Warehouse', 'Rope & Rigging Supply',
  'Navigation Instruments Ltd.', 'Safety Equipment Corp.', 'Hull Materials Supply', 'Paint & Coatings Co.',
  'Electrical Marine Supply', 'Hydraulic Systems Inc.', 'Welding Supplies Marine', 'Fasteners & Fittings Co.',
  'Plumbing Marine Supply', 'Ventilation Systems Ltd.', 'Lighting Equipment Corp.', 'Communication Gear Supply',
  'Fire Safety Marine Inc.', 'Life Raft Specialists', 'Anchor & Chain Supply', 'Propeller Services Co.',
  'Bearing & Seal Supply', 'Gasket Materials Inc.', 'Filter Systems Marine', 'Valve & Pump Supply',
  'Steel Fabrication Co.', 'Aluminum Marine Supply', 'Composite Materials Ltd.', 'Rubber Products Marine',
  'Glass & Glazing Supply', 'Insulation Materials Co.', 'Adhesives & Sealants Inc.', 'Lubricants Marine Supply',
  'Fuel Systems Equipment', 'Water Treatment Supply', 'Waste Management Marine', 'Cleaning Supplies Co.',
  'Tool Rental Marine', 'Machinery Parts Supply', 'Instrumentation Ltd.', 'Control Systems Marine',
  'Automation Equipment Co.', 'Sensor Technology Inc.', 'Cable & Wire Supply', 'Circuit Components Marine',
  'Motor & Drive Supply', 'Generator Parts Co.', 'Battery Systems Marine', 'Solar Equipment Supply'
];

const contactPersons = [
  'James Wilson', 'Sarah Mitchell', 'Michael Brown', 'Lisa Anderson', 'David Johnson',
  'Emily Davis', 'Robert Taylor', 'Amanda White', 'Christopher Lee', 'Jennifer Garcia',
  'Matthew Martinez', 'Ashley Rodriguez', 'Joshua Lewis', 'Nicole Walker', 'Daniel Hall',
  'Stephanie Allen', 'Kevin Young', 'Michelle King', 'Brian Wright', 'Laura Lopez',
  'Anthony Hill', 'Rachel Green', 'Steven Adams', 'Catherine Baker', 'Ryan Nelson',
  'Samantha Carter', 'Jason Turner', 'Kimberly Phillips', 'Brandon Campbell', 'Crystal Parker',
  'Jeremy Evans', 'Melissa Edwards', 'Aaron Collins', 'Heather Stewart', 'Nathan Sanchez',
  'Vanessa Morris', 'Tyler Rogers', 'Andrea Reed', 'Jonathan Cook', 'Teresa Bailey',
  'Marcus Rivera', 'Danielle Cooper', 'Sean Richardson', 'Monica Cox', 'Carlos Howard',
  'Shannon Ward', 'Lucas Torres', 'Tiffany Peterson', 'Gregory Gray', 'Natalie Ramirez'
];

const cities = [
  'Miami', 'Los Angeles', 'New York', 'Seattle', 'Boston', 'San Francisco', 'Houston',
  'Norfolk', 'Charleston', 'Savannah', 'Long Beach', 'Oakland', 'Portland', 'Baltimore',
  'New Orleans', 'Tampa', 'Jacksonville', 'Mobile', 'Galveston', 'San Diego',
  'Newport News', 'Wilmington', 'Corpus Christi', 'Beaumont', 'Port Arthur', 'Freeport'
];

const emailDomains = [
  '@marine.com', '@shipping.net', '@logistics.org', '@transport.biz', '@ocean.co',
  '@maritime.pro', '@cargo.info', '@freight.com', '@harbor.net', '@port.org'
];

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1-${areaCode}-${exchange}-${number}`;
}

function generateTaxId(): string {
  return `TAX${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
}

async function seedCustomersAndSuppliers() {
  console.log('Starting to seed customers and suppliers...');

  // Generate 100 customers
  const customers = [];
  for (let i = 0; i < 100; i++) {
    const companyName = sampleCompanyNames[i % sampleCompanyNames.length] + ` ${Math.floor(i / sampleCompanyNames.length) + 1}`;
    const contactPerson = contactPersons[i % contactPersons.length];
    const city = cities[i % cities.length];
    const domain = emailDomains[i % emailDomains.length];
    
    customers.push({
      name: companyName,
      contactPerson: contactPerson,
      email: `contact${i + 1}${domain}`,
      phone: generatePhoneNumber(),
      address: `${Math.floor(Math.random() * 9999) + 1} Harbor Drive, ${city}, ${['FL', 'CA', 'NY', 'WA', 'MA', 'TX'][Math.floor(Math.random() * 6)]} ${Math.floor(Math.random() * 90000) + 10000}`,
      taxId: generateTaxId(),
      userId: null
    });
  }

  // Generate 100 suppliers
  const suppliers = [];
  for (let i = 0; i < 100; i++) {
    const supplierName = supplierNames[i % supplierNames.length] + ` ${Math.floor(i / supplierNames.length) + 1}`;
    const contactPerson = contactPersons[(i + 25) % contactPersons.length];
    const city = cities[(i + 10) % cities.length];
    const domain = emailDomains[(i + 5) % emailDomains.length];
    
    suppliers.push({
      name: supplierName,
      contactPerson: contactPerson,
      email: `supplier${i + 1}${domain}`,
      phone: generatePhoneNumber(),
      address: `${Math.floor(Math.random() * 9999) + 1} Industrial Blvd, ${city}, ${['FL', 'CA', 'NY', 'WA', 'MA', 'TX'][Math.floor(Math.random() * 6)]} ${Math.floor(Math.random() * 90000) + 10000}`,
      taxId: generateTaxId(),
      bankInfo: `Bank Account: ${Math.floor(Math.random() * 1000000000).toString().padStart(10, '0')}, Routing: ${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`
    });
  }

  try {
    // Insert customers in batches
    console.log('Inserting customers...');
    for (let i = 0; i < customers.length; i += 10) {
      const batch = customers.slice(i, i + 10);
      await db.insert(schema.customers).values(batch);
      console.log(`Inserted customers ${i + 1} to ${Math.min(i + 10, customers.length)}`);
    }

    // Insert suppliers in batches
    console.log('Inserting suppliers...');
    for (let i = 0; i < suppliers.length; i += 10) {
      const batch = suppliers.slice(i, i + 10);
      await db.insert(schema.suppliers).values(batch);
      console.log(`Inserted suppliers ${i + 1} to ${Math.min(i + 10, suppliers.length)}`);
    }

    console.log('✓ Successfully seeded 100 customers and 100 suppliers!');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}

// Run the seeding function
seedCustomersAndSuppliers()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });

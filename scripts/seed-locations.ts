
import { db } from '../server/db';
import * as schema from '../shared/schema';

const locationNames = [
  'Forepeak tank deck plating', 'Forepeak tank- 1st stringer', 'Forepeak tank- 2nd stringer', 
  'Forepeak tank- 3nd stringer', 'Forepeak tank- Inner bottom', 'Forecastle deck', 
  'No.1 COT P deck plating', 'No.1 COT C deck plating', 'No.1 COT S deck plating', 
  'No.1 C/H Hatch Top sides', 'No.1 C/H - Coamings & Main deck plating', 'No.1 WBT Port deck palting', 
  'No.1 WBT Stbd deck plating', 'No.1 WBT Port- First stringer', 'No.1 WBT Port- 2nd stringer', 
  'No.1 WBT Port- 3rd stringer', 'No.1 WBT Port- 4th stringer', 'No.1 WBT Port- Double bottom', 
  'No.1 WBT Stbd- First stringer', 'No.1 WBT Stbd- 2nd stringer', 'No.1 WBT Stbd- 3rd stringer', 
  'No.1 WBT Stbd- 4th stringer', 'No.1 WBT Stbd- Double bottom', 'No.2 COT P deck plating', 
  'No.2 COT C deck plating', 'No.2 COT S deck plating', 'No.2 C/H Hatch Top sides', 
  'No.2 C/H Hatch Coamings & Main deck plating', 'No.2 WBT Port deck palting', 'No.2 WBT Stbd deck plating', 
  'No.2 WBT Port- First stringer', 'No.2 WBT Port- 2nd stringer', 'No.2 WBT Port- 3rd stringer', 
  'No.2 WBT Port- 4th stringer', 'No.2 WBT Port- Double bottom', 'No.2 WBT Stbd- First stringer', 
  'No.2 WBT Stbd- 2nd stringer', 'No.2 WBT Stbd- 3rd stringer', 'No.2 WBT Stbd- 4th stringer', 
  'No.2 WBT Stbd- Double bottom', 'No.3 COT P deck plating', 'No.3 COT C deck plating', 
  'No.3 COT S deck plating', 'No.3 C/H Hatch Top sides', 'No.3 C/H Hatch Coamings & Main deck plating', 
  'No.3 WBT Port deck palting', 'No.3 WBT Stbd deck plating', 'No.3 WBT Port- First stringer', 
  'No.3 WBT Port- 2nd stringer', 'No.3 WBT Port- 3rd stringer', 'No.3 WBT Port- 4th stringer', 
  'No.3 WBT Port- Double bottom', 'No.3 WBT Stbd- First stringer', 'No.3 WBT Stbd- 2nd stringer', 
  'No.3 WBT Stbd- 3rd stringer', 'No.3 WBT Stbd- 4th stringer', 'No.3 WBT Stbd- Double bottom', 
  'No.4 COT P deck plating', 'No.4 COT C deck plating', 'No.4 COT S deck plating', 
  'No.4 C/H Hatch Top sides', 'No.4 C/H Hatch Coamings & Main deck plating', 'No.4 WBT Port deck palting', 
  'No.4 WBT Stbd deck plating', 'No.4 WBT Port- First stringer', 'No.4 WBT Port- 2nd stringer', 
  'No.4 WBT Port- 3rd stringer', 'No.4 WBT Port- 4th stringer', 'No.4 WBT Port- Double bottom', 
  'No.4 WBT Stbd- First stringer', 'No.4 WBT Stbd- 2nd stringer', 'No.4 WBT Stbd- 3rd stringer', 
  'No.4 WBT Stbd- 4th stringer', 'No.4 WBT Stbd- Double bottom', 'No.5 COT P deck plating', 
  'No.5 COT C deck plating', 'No.5 COT S deck plating', 'No.5 C/H Hatch Top sides', 
  'No.5 C/H Hatch Coamings & Main deck plating', 'No.5 WBT Port deck palting', 'No.5 WBT Stbd deck plating', 
  'No.5 WBT Port- First stringer', 'No.5 WBT Port- 2nd stringer', 'No.5 WBT Port- 3rd stringer', 
  'No.5 WBT Port- 4th stringer', 'No.5 WBT Port- Double bottom', 'No.5 WBT Stbd- First stringer', 
  'No.5 WBT Stbd- 2nd stringer', 'No.5 WBT Stbd- 3rd stringer', 'No.5 WBT Stbd- 4th stringer', 
  'No.5 WBT Stbd- Double bottom', 'No.6 COT P deck plating', 'No.6 COT C deck plating', 
  'No.6 COT S deck plating', 'No.6 C/H Hatch Top sides', 'No.6 C/H Hatch Coamings & Main deck plating', 
  'No.6 WBT Port deck palting', 'No.6 WBT Stbd deck plating', 'No.6 WBT Port- First stringer', 
  'No.6 WBT Port- 2nd stringer', 'No.6 WBT Port- 3rd stringer', 'No.6 WBT Port- 4th stringer', 
  'No.6 WBT Port- Double bottom', 'No.6 WBT Stbd- First stringer', 'No.6 WBT Stbd- 2nd stringer', 
  'No.6 WBT Stbd- 3rd stringer', 'No.6 WBT Stbd- 4th stringer', 'No.6 WBT Stbd - Double bottom', 
  'Poop Deck', 'Aft peak tank deck plating', 'Aft peak tank- First stringer', 
  'Aft peak tank- Second stringer', 'Aft peak tank- Third stringer'
];

async function seedLocations() {
  console.log('Starting to seed default locations...');

  try {
    for (const name of locationNames) {
      await db.insert(schema.locations).values({ name }).onConflictDoNothing();
    }
    console.log(`✓ Successfully seeded ${locationNames.length} locations!`);
  } catch (error) {
    console.error('Error seeding locations:', error);
    throw error;
  }
}

// Run the seeding function
seedLocations()
  .then(() => {
    console.log('Location seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Location seeding failed:', error);
    process.exit(1);
  });

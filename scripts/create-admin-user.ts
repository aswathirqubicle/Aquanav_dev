import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcrypt";

async function createAdminUser() {
  try {
    console.log("Creating admin user...");
    
    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where((users) => users.username === "admin")
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("Admin user already exists with username: admin");
      return;
    }
    
    // Hash the default password
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    // Create admin user
    const [adminUser] = await db
      .insert(users)
      .values({
        username: "admin",
        email: "admin@aquanav.com",
        password: hashedPassword,
        role: "admin",
        isActive: true,
      })
      .returning();
    
    console.log("Admin user created successfully!");
    console.log("Username: admin");
    console.log("Password: admin123");
    console.log("Role: admin");
    console.log("");
    console.log("You can now log in and create additional users.");
    
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();
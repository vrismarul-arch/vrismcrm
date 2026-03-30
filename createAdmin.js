import bcrypt from "bcryptjs";
import Admin from "./models/Admin.js";

const createAdmin = async () => {
  const existing = await Admin.findOne({ email: "admin@gmail.com" });

  if (existing) {
    console.log("Admin already exists ✅");
    return;
  }

  const hashedPassword = await bcrypt.hash("admin123", 10); // default password

  await Admin.create({
    name: "Super Admin",
    email: "admin@gmail.com",
    password: hashedPassword,
    role: "Superadmin"
  });

  console.log("✅ Admin created with default password: admin123");
};

export default createAdmin;
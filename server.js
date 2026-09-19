import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Database connection
import connectDB from "./config/db.js";
import createAdminUser from "./config/adminSetup.js";

// Routes
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import priceListRoutes from "./routes/priceList.js";
import settingsRoutes from "./routes/settings.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to MongoDB
connectDB();

// Create admin user on startup
createAdminUser();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));




// Ensure uploads directory exists
import fs from 'fs';
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Uploads directory created');
}

// Static file serving (uploads) - FIXED PATH
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/pricelist", priceListRoutes);
app.use("/settings", settingsRoutes);

// Serve uploaded files with proper URL
app.get('/api/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: 'Image not found' });
  }
});

// Basic route for testing
app.get("/api", (req, res) => {
  res.json({ message: "Crackers Shop API is running!" });
});

// Start server
const PORT = process.env.PORT || 3010;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📁 Uploads directory: ${path.join(__dirname, "uploads")}`);
  console.log(`🌐 Image URL: http://localhost:${PORT}/uploads/`);
});
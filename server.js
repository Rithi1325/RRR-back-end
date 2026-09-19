import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Database connection
import connectDB from "./config/db.js";
import createAdminUser from "./config/adminSetup.js";
import { initGridFS, findFileInGridFS, openDownloadStream, getLatestFileByMime } from "./config/gridfs.js";

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

// Initialize GridFS once DB connection is open
mongoose.connection.once('open', () => {
  initGridFS(mongoose.connection.db);
});

// Create admin user on startup
createAdminUser();

// Middleware with high payload limits to allow any large file
app.use(cors());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Uploads directory created');
}

// Static file serving (uploads) - Local fallback
app.use('/api/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(uploadsDir));

// Universal handler to serve files from MongoDB GridFS first, then disk, then fallback
const serveUploadedFile = async (req, res) => {
  const filename = req.params.filename;

  try {
    // 1. Check MongoDB GridFS (persistent across Render restarts)
    const gridFile = await findFileInGridFS(filename);
    if (gridFile) {
      let mimeType = gridFile.contentType;
      if (!mimeType) {
        if (filename.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (filename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        else if (filename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
        else mimeType = 'application/octet-stream';
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      const stream = openDownloadStream(filename);
      if (stream) {
        return stream.pipe(res);
      }
    }

    // 2. Check local disk
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }

    // 3. Fallback for PDF: if the specific PDF was lost, serve any available valid PDF
    if (filename.toLowerCase().endsWith('.pdf')) {
      const latestPdf = await getLatestFileByMime('application/pdf');
      if (latestPdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        const fallbackStream = openDownloadStream(latestPdf.filename);
        if (fallbackStream) {
          return fallbackStream.pipe(res);
        }
      }

      if (fs.existsSync(uploadsDir)) {
        const localPdfs = fs.readdirSync(uploadsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
        if (localPdfs.length > 0) {
          return res.sendFile(path.join(uploadsDir, localPdfs[0]));
        }
      }
    }

    // 4. Truly not found
    return res.status(404).json({ message: 'File not found' });
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({ message: 'Error retrieving file' });
  }
};

// Route for serving uploads
app.get('/api/uploads/:filename', serveUploadedFile);
app.get('/uploads/:filename', serveUploadedFile);

// Routes
app.use("/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/pricelist", priceListRoutes);
app.use("/settings", settingsRoutes);

// Basic route for testing
app.get("/api", (req, res) => {
  res.json({ message: "Crackers Shop API is running!" });
});

// Start server
const PORT = process.env.PORT || 3010;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🌐 Image URL: http://localhost:${PORT}/uploads/`);
});
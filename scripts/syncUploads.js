import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initGridFS, findFileInGridFS, uploadToGridFS } from '../config/gridfs.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

async function syncAll() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');

  initGridFS(mongoose.connection.db);

  if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️ Uploads directory not found:', uploadsDir);
    await mongoose.disconnect();
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  console.log(`📂 Found ${files.length} files in local uploads directory.`);

  let uploadedCount = 0;
  let alreadyExistsCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    try {
      const existing = await findFileInGridFS(file);
      if (existing) {
        alreadyExistsCount++;
        continue;
      }

      let mimeType = 'application/octet-stream';
      const lower = file.toLowerCase();
      if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else if (lower.endsWith('.gif')) mimeType = 'image/gif';

      await uploadToGridFS(filePath, file, mimeType);
      console.log(`✅ Uploaded to GridFS: ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
      uploadedCount++;
    } catch (err) {
      console.error(`❌ Failed to upload ${file}:`, err.message);
      failedCount++;
    }
  }

  console.log('\n📊 Sync Summary:');
  console.log(`- Total local files: ${files.length}`);
  console.log(`- Newly uploaded to GridFS: ${uploadedCount}`);
  console.log(`- Already existed in GridFS: ${alreadyExistsCount}`);
  console.log(`- Failed: ${failedCount}`);

  // Also verify total files now in GridFS
  const totalGridFS = await mongoose.connection.db.collection('uploads.files').countDocuments();
  console.log(`- Total files now permanently in MongoDB Atlas GridFS: ${totalGridFS}`);

  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
}

syncAll().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});

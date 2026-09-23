import mongoose from 'mongoose';
import fs from 'fs';

let gfsBucket = null;

export const initGridFS = (db) => {
  const targetDb = db || mongoose.connection.db;
  if (!targetDb) {
    console.error('GridFS init failed: No database connection');
    return null;
  }
  gfsBucket = new mongoose.mongo.GridFSBucket(targetDb, {
    bucketName: 'uploads'
  });
  console.log('✅ GridFS Bucket initialized (uploads)');
  return gfsBucket;
};

export const getGridFSBucket = () => {
  if (!gfsBucket && mongoose.connection?.db) {
    return initGridFS(mongoose.connection.db);
  }
  return gfsBucket;
};

export const uploadToGridFS = (filePath, filename, mimetype = 'application/octet-stream') => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(uploadStream)
      .on('error', (err) => reject(err))
      .on('finish', () => resolve(uploadStream.id));
  });
};

export const uploadBufferToGridFS = (buffer, filename, mimetype = 'application/octet-stream') => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype
    });

    uploadStream.end(buffer, () => {
      resolve(uploadStream.id);
    });
    uploadStream.on('error', (err) => reject(err));
  });
};

export const findFileInGridFS = async (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;
  const files = await bucket.find({ filename }).sort({ uploadDate: -1 }).toArray();
  return files && files.length > 0 ? files[0] : null;
};

export const getLatestFileByMime = async (mimePattern = 'application/pdf') => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;
  const files = await bucket.find({ contentType: mimePattern }).sort({ uploadDate: -1 }).toArray();
  return files && files.length > 0 ? files[0] : null;
};

export const openDownloadStream = (filenameOrId) => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;

  try {
    if (filenameOrId instanceof mongoose.Types.ObjectId) {
      return bucket.openDownloadStream(filenameOrId);
    }
    if (typeof filenameOrId === 'string' && mongoose.Types.ObjectId.isValid(filenameOrId) && String(new mongoose.Types.ObjectId(filenameOrId)) === filenameOrId) {
      return bucket.openDownloadStream(new mongoose.Types.ObjectId(filenameOrId));
    }
    return bucket.openDownloadStreamByName(filenameOrId);
  } catch (err) {
    console.error(`Error opening download stream for ${filenameOrId}:`, err.message);
    return null;
  }
};

export const deleteFromGridFS = async (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket || !filename) return;

  try {
    const files = await bucket.find({ filename }).toArray();
    for (const file of files) {
      await bucket.delete(file._id);
      console.log(`🗑️ Removed ${filename} (${file._id}) from GridFS`);
    }
  } catch (err) {
    console.error(`Error deleting ${filename} from GridFS:`, err.message);
  }
};

export const syncLocalUploadsToGridFS = async (uploadsDir) => {
  const bucket = getGridFSBucket();
  if (!bucket || !fs.existsSync(uploadsDir)) return;

  try {
    const files = fs.readdirSync(uploadsDir);
    let synced = 0;

    for (const file of files) {
      const filePath = `${uploadsDir}/${file}`.replace(/\\/g, '/');
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        const existing = await findFileInGridFS(file);
        if (!existing) {
          let mimeType = 'application/octet-stream';
          const lower = file.toLowerCase();
          if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (lower.endsWith('.png')) mimeType = 'image/png';
          else if (lower.endsWith('.webp')) mimeType = 'image/webp';
          else if (lower.endsWith('.gif')) mimeType = 'image/gif';

          await uploadToGridFS(filePath, file, mimeType);
          synced++;
        }
      } catch (fileErr) {
        console.error(`Error syncing ${file} to GridFS:`, fileErr.message);
      }
    }

    if (synced > 0) {
      console.log(`📦 Auto-synced ${synced} local upload(s) to MongoDB GridFS`);
    }
  } catch (err) {
    console.error('Error during local-to-GridFS sync:', err.message);
  }
};


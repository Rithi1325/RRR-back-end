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

export const openDownloadStream = (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;
  return bucket.openDownloadStreamByName(filename);
};

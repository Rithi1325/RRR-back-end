import PriceList from '../models/PriceList.js';
import { uploadToGridFS } from '../config/gridfs.js';

export const getLatestPriceList = async (req, res) => {
  try {
    // Sort by createdAt: -1 so the most recently uploaded price list is ALWAYS served
    const priceList = await PriceList.findOne().sort({ createdAt: -1, _id: -1 });

    if (!priceList) {
      return res.status(404).json({ message: 'No price list uploaded yet' });
    }

    res.json({
      ...priceList.toObject(),
      url: `/api/uploads/${priceList.fileName}`
    });
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadPriceList = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF price list is required' });
    }

    if (!req.body.effectiveDate) {
      return res.status(400).json({ message: 'Effective date is required' });
    }

    const effectiveDate = new Date(`${req.body.effectiveDate}T00:00:00.000Z`);
    if (Number.isNaN(effectiveDate.getTime())) {
      return res.status(400).json({ message: 'Effective date is invalid' });
    }

    // Persist PDF directly into MongoDB Atlas via GridFS so it never gets lost on Render restarts
    try {
      await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'application/pdf');
      console.log(`✅ Uploaded ${req.file.filename} to MongoDB GridFS`);
    } catch (gridErr) {
      console.error('Warning: Failed to upload to GridFS:', gridErr);
    }

    const priceList = await PriceList.create({
      fileName: req.file.filename,
      effectiveDate
    });

    res.status(201).json({
      ...priceList.toObject(),
      url: `/api/uploads/${priceList.fileName}`
    });
  } catch (error) {
    console.error('Error uploading price list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

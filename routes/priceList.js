import express from 'express';
import multer from 'multer';
import path from 'path';
import auth from '../middleware/auth.js';
import { getLatestPriceList, uploadPriceList } from '../controllers/priceListController.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `pricelist-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.get('/', getLatestPriceList);
router.post('/', auth, upload.single('priceList'), uploadPriceList);

export default router;

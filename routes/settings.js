import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Public route to check if site is active and get coming soon message
router.get('/', getSettings);

// Protected admin route to update settings
router.put('/', auth, updateSettings);

export default router;

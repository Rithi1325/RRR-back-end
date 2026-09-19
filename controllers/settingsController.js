import Settings from '../models/Settings.js';

// Get current public settings (creates default if none exists)
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        isWebsiteActive: true,
        comingSoonTitle: 'Grand Diwali Sale Opening Soon!',
        comingSoonSubtitle: 'RRR Crackers - Sivakasi Genuine Direct Wholesale Fireworks',
        comingSoonMessage: 'We are currently preparing our exclusive catalog and special discounts for the upcoming festive season. Our online ordering portal will be active shortly!',
        contactPhone: '+91 98659 02681',
        contactWhatsApp: '919865902681'
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Server error fetching settings', error: error.message });
  }
};

// Update settings (Admin only)
export const updateSettings = async (req, res) => {
  try {
    const {
      isWebsiteActive,
      comingSoonTitle,
      comingSoonSubtitle,
      comingSoonMessage,
      contactPhone,
      contactWhatsApp
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (typeof isWebsiteActive === 'boolean') {
      settings.isWebsiteActive = isWebsiteActive;
    }
    if (comingSoonTitle !== undefined) {
      settings.comingSoonTitle = comingSoonTitle;
    }
    if (comingSoonSubtitle !== undefined) {
      settings.comingSoonSubtitle = comingSoonSubtitle;
    }
    if (comingSoonMessage !== undefined) {
      settings.comingSoonMessage = comingSoonMessage;
    }
    if (contactPhone !== undefined) {
      settings.contactPhone = contactPhone;
    }
    if (contactWhatsApp !== undefined) {
      settings.contactWhatsApp = contactWhatsApp;
    }

    const savedSettings = await settings.save();
    res.json(savedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server error updating settings', error: error.message });
  }
};

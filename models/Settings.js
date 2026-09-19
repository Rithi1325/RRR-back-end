import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  isWebsiteActive: {
    type: Boolean,
    default: true
  },
  comingSoonTitle: {
    type: String,
    default: 'Grand Diwali Sale Opening Soon!'
  },
  comingSoonSubtitle: {
    type: String,
    default: 'RRR Crackers - Sivakasi Genuine Direct Wholesale Fireworks'
  },
  comingSoonMessage: {
    type: String,
    default: 'We are currently preparing our exclusive catalog and special discounts for the upcoming festive season. Our online ordering portal will be active shortly!'
  },
  contactPhone: {
    type: String,
    default: '+91 98659 02681'
  },
  contactWhatsApp: {
    type: String,
    default: '919865902681'
  }
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);

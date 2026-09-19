import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
    ta: { type: String, required: true }
  },
  description: {
    en: { type: String },
    ta: { type: String }
  },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model('Product', productSchema);
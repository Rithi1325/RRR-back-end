import mongoose from 'mongoose';

const priceListSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  effectiveDate: { type: Date, required: true }
}, {
  timestamps: true
});

export default mongoose.model('PriceList', priceListSchema);

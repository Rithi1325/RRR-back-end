import Product from '../models/Product.js';
import fs from 'fs';
import path from 'path';
import { uploadToCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { uploadToGridFS, deleteFromGridFS } from '../config/gridfs.js';

export const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    let filter = { isActive: true };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { 'name.en': { $regex: search, $options: 'i' } },
        { 'name.ta': { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    
    // Fix image URL construction (support Cloudinary and local uploads)
    const productsWithImageUrl = products.map(product => ({
      ...product.toObject(),
      imageUrl: product.image 
        ? (product.image.startsWith('http') ? product.image : `/api/uploads/${product.image}`)
        : null
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Add full image URL (support Cloudinary and local uploads)
    const productWithImageUrl = {
      ...product.toObject(),
      imageUrl: product.image 
        ? (product.image.startsWith('http') ? product.image : `/uploads/${product.image}`)
        : null
    };
    
    res.json(productWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const createProduct = async (req, res) => {
  try {
    console.log('Request file:', req.file);
    console.log('Request body:', req.body);
    
    const { name, description, price, category, purchaseLimit } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Product image is required' });
    }

    // Parse the name
    let nameEn = req.body['name[en]'] || '';
    let nameTa = req.body['name[ta]'] || '';
    if (name) {
      if (typeof name === 'object') {
        nameEn = name.en || nameEn;
        nameTa = name.ta || nameTa;
      } else {
        try {
          const parsed = JSON.parse(name);
          nameEn = parsed.en || nameEn;
          nameTa = parsed.ta || nameTa;
        } catch {
          nameEn = name || nameEn;
        }
      }
    }

    // Parse the description
    let descEn = req.body['description[en]'] || '';
    let descTa = req.body['description[ta]'] || '';
    if (description) {
      if (typeof description === 'object') {
        descEn = description.en || descEn;
        descTa = description.ta || descTa;
      } else {
        try {
          const parsed = JSON.parse(description);
          descEn = parsed.en || descEn;
          descTa = parsed.ta || descTa;
        } catch {
          descEn = description || descEn;
        }
      }
    }

    // Determine image storage: Cloudinary cloud storage or MongoDB Atlas GridFS
    let imageValue = req.file.filename;

    if (isCloudinaryConfigured()) {
      try {
        console.log('☁️ Uploading product image to Cloudinary...');
        const cloudUpload = await uploadToCloudinary(req.file.path, 'rrr-crackers/products');
        imageValue = cloudUpload.url;
        console.log('✅ Uploaded to Cloudinary:', imageValue);

        // Delete local temporary file since it is securely stored on Cloudinary
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      } catch (cloudErr) {
        console.error('⚠️ Cloudinary upload failed, falling back to MongoDB GridFS:', cloudErr.message);
        imageValue = req.file.filename;
        try {
          await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
          console.log(`✅ Uploaded ${req.file.filename} to MongoDB GridFS (fallback)`);
        } catch (gridErr) {
          console.error('Warning: Failed to upload to GridFS:', gridErr);
        }
      }
    } else {
      // Cloudinary not configured -> ALWAYS persist into MongoDB Atlas via GridFS
      try {
        await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
        console.log(`✅ Uploaded product image ${req.file.filename} to MongoDB GridFS`);
      } catch (gridErr) {
        console.error('⚠️ Failed to upload product image to GridFS:', gridErr);
      }
    }

    const product = new Product({
      name: {
        en: nameEn,
        ta: nameTa
      },
      description: {
        en: descEn,
        ta: descTa
      },
      price: parseFloat(price),
      category: category ? category.toLowerCase().trim() : '',
      purchaseLimit: purchaseLimit !== undefined && purchaseLimit !== '' ? Math.max(0, parseInt(purchaseLimit, 10) || 0) : 0,
      image: imageValue
    });

    await product.save();

    // Add full image URL to response
    const productWithImageUrl = {
      ...product.toObject(),
      imageUrl: product.image.startsWith('http') ? product.image : `/uploads/${product.image}`
    };
    
    res.status(201).json(productWithImageUrl);
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Delete uploaded file if product creation fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
    }
    
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updateData = {};

    // Name
    let nameEn = req.body['name[en]'];
    let nameTa = req.body['name[ta]'];
    if (req.body.name) {
      if (typeof req.body.name === 'object') {
        if (req.body.name.en !== undefined) nameEn = req.body.name.en;
        if (req.body.name.ta !== undefined) nameTa = req.body.name.ta;
      } else {
        try {
          const parsed = JSON.parse(req.body.name);
          if (parsed.en !== undefined) nameEn = parsed.en;
          if (parsed.ta !== undefined) nameTa = parsed.ta;
        } catch {
          nameEn = req.body.name;
        }
      }
    }
    if (nameEn !== undefined) updateData['name.en'] = nameEn;
    if (nameTa !== undefined) updateData['name.ta'] = nameTa;

    // Description
    let descEn = req.body['description[en]'];
    let descTa = req.body['description[ta]'];
    if (req.body.description) {
      if (typeof req.body.description === 'object') {
        if (req.body.description.en !== undefined) descEn = req.body.description.en;
        if (req.body.description.ta !== undefined) descTa = req.body.description.ta;
      } else {
        try {
          const parsed = JSON.parse(req.body.description);
          if (parsed.en !== undefined) descEn = parsed.en;
          if (parsed.ta !== undefined) descTa = parsed.ta;
        } catch {
          descEn = req.body.description;
        }
      }
    }
    if (descEn !== undefined) updateData['description.en'] = descEn;
    if (descTa !== undefined) updateData['description.ta'] = descTa;

    // Price
    if (req.body.price !== undefined && req.body.price !== '') {
      updateData.price = parseFloat(req.body.price);
    }

    // Category
    if (req.body.category !== undefined && req.body.category !== '') {
      updateData.category = req.body.category.toLowerCase().trim();
    }

    // Purchase Limit (max qty per user/order; 0 = unlimited)
    if (req.body.purchaseLimit !== undefined) {
      updateData.purchaseLimit = req.body.purchaseLimit !== '' ? Math.max(0, parseInt(req.body.purchaseLimit, 10) || 0) : 0;
    }

    // If new image is uploaded
    if (req.file) {
      let imageValue = req.file.filename;

      if (isCloudinaryConfigured()) {
        try {
          console.log('☁️ Uploading updated image to Cloudinary...');
          const cloudUpload = await uploadToCloudinary(req.file.path, 'rrr-crackers/products');
          imageValue = cloudUpload.url;
          console.log('✅ Uploaded to Cloudinary:', imageValue);

          try { fs.unlinkSync(req.file.path); } catch (e) {}
        } catch (cloudErr) {
          console.error('⚠️ Cloudinary upload failed, falling back to MongoDB GridFS:', cloudErr.message);
          imageValue = req.file.filename;
          try {
            await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
            console.log(`✅ Uploaded updated image ${req.file.filename} to MongoDB GridFS (fallback)`);
          } catch (gridErr) {
            console.error('Warning: Failed to upload to GridFS:', gridErr);
          }
        }
      } else {
        // Cloudinary not configured -> ALWAYS persist new image into MongoDB Atlas via GridFS
        try {
          await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
          console.log(`✅ Uploaded updated product image ${req.file.filename} to MongoDB GridFS`);
        } catch (gridErr) {
          console.error('⚠️ Failed to upload updated image to GridFS:', gridErr);
        }

        // Clean up previous image from GridFS and local disk if it changed
        if (product.image && !product.image.startsWith('http') && product.image !== req.file.filename) {
          deleteFromGridFS(product.image).catch(() => {});
          const oldImagePath = path.join('uploads', product.image);
          if (fs.existsSync(oldImagePath)) {
            try { fs.unlinkSync(oldImagePath); } catch (e) {}
          }
        }
      }

      updateData.image = imageValue;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    const productWithImageUrl = {
      ...updatedProduct.toObject(),
      imageUrl: updatedProduct.image 
        ? (updatedProduct.image.startsWith('http') ? updatedProduct.image : `/uploads/${updatedProduct.image}`) 
        : null
    };

    res.json(productWithImageUrl);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product && product.image && !product.image.startsWith('http')) {
      deleteFromGridFS(product.image).catch(() => {});
      const imagePath = path.join('uploads', product.image);
      if (fs.existsSync(imagePath)) {
        try { fs.unlinkSync(imagePath); } catch (e) {}
      }
    }
    
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};
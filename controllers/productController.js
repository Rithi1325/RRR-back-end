import Product from '../models/Product.js';
import fs from 'fs';
import path from 'path';
import { uploadToGridFS } from '../config/gridfs.js';

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
    
    // Fix image URL construction
    const productsWithImageUrl = products.map(product => ({
      ...product.toObject(),
      imageUrl: product.image ? `/api/uploads/${product.image}` : null
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Add full image URL
    const productWithImageUrl = {
      ...product.toObject(),
      imageUrl: product.image ? `/uploads/${product.image}` : null
    };
    
    res.json(productWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProduct = async (req, res) => {
  try {
    console.log('Request file:', req.file);
    console.log('Request body:', req.body);
    
    const { name, description, price, category } = req.body;
    
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
      image: req.file.filename
    });

    await product.save();
    
    if (req.file) {
      try {
        await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
      } catch (gridErr) {
        console.error('GridFS product image upload error:', gridErr);
      }
    }

    // Add full image URL to response
    const productWithImageUrl = {
      ...product.toObject(),
      imageUrl: `/uploads/${product.image}`
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
    
    res.status(500).json({ message: 'Server error' });
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

    // If new image is uploaded, delete old image
    if (req.file) {
      if (product.image) {
        const oldImagePath = path.join('uploads', product.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error('Error deleting old image:', err);
          }
        }
      }
      updateData.image = req.file.filename;
      try {
        await uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype || 'image/jpeg');
      } catch (gridErr) {
        console.error('GridFS product image update error:', gridErr);
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    const productWithImageUrl = {
      ...updatedProduct.toObject(),
      imageUrl: updatedProduct.image ? `/uploads/${updatedProduct.image}` : null
    };

    res.json(productWithImageUrl);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product && product.image) {
      // Delete image file
      const imagePath = path.join('uploads', product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
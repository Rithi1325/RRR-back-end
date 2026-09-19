import Product from '../models/Product.js';
import fs from 'fs';
import path from 'path';

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

    // Parse the name if it's a JSON string
    let nameObj;
    try {
      nameObj = typeof name === 'string' ? JSON.parse(name) : name;
    } catch (error) {
      nameObj = { en: name || '', ta: '' };
    }

    const product = new Product({
      name: {
        en: nameObj.en || '',
        ta: nameObj.ta || ''
      },
      description: {
        en: description?.en || '',
        ta: description?.ta || ''
      },
      price: parseFloat(price),
      category: category.toLowerCase(), // Ensure lowercase for consistency
      image: req.file.filename
    });

    await product.save();
    
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
      fs.unlinkSync(req.file.path);
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

    // If new image is uploaded, delete old image
    if (req.file) {
      // Delete old image file
      if (product.image) {
        const oldImagePath = path.join('uploads', product.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      req.body.image = req.file.filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    // Add image URL to response
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
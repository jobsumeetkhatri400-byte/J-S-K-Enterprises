// api/products.js - Vercel Serverless Function
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all products
      const result = await pool.query(`
        SELECT p.*, 
               json_agg(DISTINCT jsonb_build_object('key', s.key, 'value', s.value)) as specs
        FROM products p
        LEFT JOIN product_specs s ON p.id = s.product_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      // Add new product
      const { name, category, price, description, image, specs, featured } = req.body;
      
      const result = await pool.query(
        `INSERT INTO products (name, category, price, description, image, featured, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id`,
        [name, category, price, description, image, featured || false]
      );
      
      const productId = result.rows[0].id;
      
      // Add specs
      if (specs) {
        for (const [key, value] of Object.entries(specs)) {
          await pool.query(
            'INSERT INTO product_specs (product_id, key, value) VALUES ($1, $2, $3)',
            [productId, key, value]
          );
        }
      }
      
      return res.status(201).json({ success: true, id: productId });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await pool.query('DELETE FROM product_specs WHERE product_id = $1', [id]);
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}

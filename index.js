require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(helmet());
app.use(cors());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

// Health check
app.get('/health', (req, res) => {
  res.send('School API is running 🚀');
});

// Add School API
app.post('/addSchool', async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    // Validation
    if (!name || !name.trim() || !address || !address.trim()) {
      return res.status(400).json({ error: 'Name and address must not be empty' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90 ||
        isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    // Insert into DB
    const [result] = await pool.query(
      'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name.trim(), address.trim(), lat, lng]
    );

    res.status(201).json({
      success: true,
      message: 'School added successfully',
      schoolId: result.insertId
    });
  } catch (error) {
    console.error('Add School Error:', error);
    res.status(500).json({ error: 'Database error while adding school' });
  }
});

// List Schools API (sorted by distance)
app.get('/listSchools', async (req, res) => {
  try {
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'Latitude and longitude are required as numbers' });
    }

    // Fetch schools
    const [schools] = await pool.query('SELECT * FROM schools');

    // Haversine formula for distance
    const getDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
                Math.cos(lat1*Math.PI/180) *
                Math.cos(lat2*Math.PI/180) *
                Math.sin(dLng/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Add distance field to each school
    const schoolsWithDistance = schools.map(school => ({
      id: school.id,
      name: school.name,
      address: school.address,
      latitude: school.latitude,
      longitude: school.longitude,
      distance: getDistance(userLat, userLng, school.latitude, school.longitude)
    }));

    // Sort by nearest first
    schoolsWithDistance.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      count: schoolsWithDistance.length,
      schools: schoolsWithDistance
    });
  } catch (error) {
    console.error('List Schools Error:', error);
    res.status(500).json({ error: 'Database error while listing schools' });
  }
});

// Server listen
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));



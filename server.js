const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Set some defaults (required if your db.json is empty)
db.defaults({ users: [] }).write();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// API routes
app.get('/api/users', (req, res) => {
  const users = db.get('users').value();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const newUser = req.body;
  newUser.id = Date.now(); // Simple ID
  db.get('users').push(newUser).write();
  res.status(201).json(newUser);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

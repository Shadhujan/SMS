const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const shortid = require('shortid');
const session = require('express-session');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Adjust the number of salt rounds as needed
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));  
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Load user data from JSON file
fs.readFile('user.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading user data:', err);
    return;
  }

  try {
    userData = JSON.parse(data);
  } catch (parseError) {
    console.error('Error parsing user data:', parseError);
  }
});

// Load student data from JSON file
fs.readFile('student.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading student data:', err);
    return;
  }

  try {
    studentData = JSON.parse(data);
  } catch (parseError) {
    console.error('Error parsing student data:', parseError);
  }
});


// User login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Find user by username
  const user = userData.find((user) => user.username === username);

  if (user) {
    // Compare passwords (not secure, for demonstration purposes only)
    if (password === user.password) {
      req.session.user = user; // Store user data in the session
      res.redirect('/students');
    } else {
      // Incorrect password
      res.status(401).send('Incorrect password');
    }
  } else {
    // User not found
    res.status(404).send('User not found');
  }
});

// Update user account
app.post('/updateUser', (req, res) => {
  if (req.session.user) {
    const { username, password } = req.body;
    const user = req.session.user;

    // Find the user in the userData array
    const userIndex = userData.findIndex((u) => u.username === user.username);

    if (userIndex !== -1) {
      // Update the user's username and password
      userData[userIndex].username = username;
      userData[userIndex].password = password;

      // Save the updated user data to the user.json file
      saveData('user.json', userData);

      res.send('User account updated successfully');
    } else {
      res.status(404).send('User not found');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Retrieve user details
app.get('/getUserDetails', (req, res) => {
  if (req.session.user) {
    const user = req.session.user;

    res.json(user);
  } else {
    res.status(401).send('Unauthorized');
  }
});



// User logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error occurred during logout:', err);
    }
    res.redirect('/');
  });
});

// Root path
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/students');
  } else {
    // Display a popup message using alert()
    const message = 'Welcome to the student management system. Please log in.';
    res.send(`
      <script>
        alert('${message}');
        window.location.href = '/user.html'; // Redirect to user.html after displaying the popup
      </script>
    `);
  }
});


// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/studentDB', { useNewUrlParser: true, useUnifiedTopology: true });

// Define the student schema
const studentSchema = new mongoose.Schema({
  sid: String,
  firstname: String,
  lastname: String,
  email: String,
  city: String,
  course: [String], // Use an array for course
  guardian: String,
  subjects: [String], // Use an array for subjects
});

// Create a mongoose model based on the schema
const Student = mongoose.model('Student', studentSchema);

// View all students
app.get('/students', async (req, res) => {
  if (req.session.user) {
    try {
      const students = await Student.find({});
      res.json(students);
    } catch (err) {
      console.error('Error fetching students from MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// View student by SID
app.get('/students/:sid', async (req, res) => {
  if (req.session.user) {
    const sid = req.params.sid;

    try {
      const student = await Student.findOne({ sid: sid });
      if (student) {
        res.json(student);
      } else {
        res.status(404).json({ error: 'Student not found' });
      }
    } catch (err) {
      console.error('Error fetching student from MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Add a new student
app.post('/students', async (req, res) => {
  if (req.session.user) {
    const { firstname, lastname, email, city, course, guardian, subjects } = req.body;

    const newStudent = new Student({
      sid: shortid.generate(),
      firstname: firstname,
      lastname: lastname,
      email: email,
      city: city,
      course: course,
      guardian: guardian,
      subjects: subjects,
    });

    try {
      await newStudent.save();
      res.send('New student added successfully');
    } catch (err) {
      console.error('Error saving student to MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});


// Edit student by SID
app.put('/students/:sid', async (req, res) => {
  if (req.session.user) {
    const sid = req.params.sid;
    const updatedStudent = req.body;

    try {
      const result = await Student.updateOne({ sid: sid }, updatedStudent);
      if (result.nModified > 0) {
        res.send('Student updated successfully');
      } else {
        res.status(404).send('Student not found');
      }
    } catch (err) {
      console.error('Error updating student in MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Delete student by SID
app.delete('/students/:sid', async (req, res) => {
  if (req.session.user) {
    const sid = req.params.sid;

    try {
      const result = await Student.deleteOne({ sid: sid });
      if (result.deletedCount > 0) {
        res.send('Student deleted successfully');
      } else {
        res.status(404).send('Student not found');
      }
    } catch (err) {
      console.error('Error deleting student from MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Helper function to save data to a JSON file
function saveData(filename, data) {
  fs.writeFile(filename, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error saving data:', err);
    }
  });
}

// View all students
app.get('/students', async (req, res) => {
  if (req.session.user) {
    try {
      const students = await Student.find({});
      res.json(students);
    } catch (err) {
      console.error('Error fetching students from MongoDB:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Create an Express app
const app = express();
app.use(cors());

// Connect to MongoDB using Mongoose
mongoose.connect('mongodb://localhost:27017/engigrowdatabase', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.log('Error connecting to MongoDB:', err);
  });

// Set up middleware to handle JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
// Post schema
const postSchema = new mongoose.Schema({
  post: {
    type: String,
    required: true,
    trim: true,
  },
  user: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  comments: [commentSchema],
  likeCount: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] }
});

postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Post = mongoose.model('Post', postSchema);

// User schema
const userSchema = new mongoose.Schema({
  name: String,
  college: String,
  interests: String,
  email: { type: String, unique: true },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters long"],
    maxlength: [128, "Password must not exceed 128 characters"],
    validate: {
      validator: function (value) {
        // At least one uppercase letter, one lowercase letter, one number, and one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
      },
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    },
  },
});

// Hash the password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Middleware to authenticate user via JWT token
const fetchUser = async (req, res, next) => {
  
  const token = req.header('Authorization') && req.header('Authorization').split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'thisisscrt'; // Use environment variable in production

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    req.user = user;
     // Attach the user to the request
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// Registration route
app.post('/register', async (req, res) => {
  try {
    const { name, college, interests, email, password, confirmPassword } = req.body;

    if (!name || !college || !interests || !email || !password) {
      return res.status(400).json({ error: 'All fields are required except confirmPassword.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const newUser = new User({
      name,
      college,
      interests,
      email,
      password,
    });

    const savedUser = await newUser.save();
    const JWT_SECRET = process.env.JWT_SECRET || 'thisisscrt';
    const tokenPayload = {
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: 'User registered successfully', token });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const JWT_SECRET = process.env.JWT_SECRET || 'thisisscrt';
      const tokenPayload = {
        id: user._id,
        name: user.name,
        email: user.email,
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      return res.status(200).json({ message: 'Login successful', token });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Profile route (protected)
app.get('/profile', fetchUser, (req, res) => {
  const { name, college, interests } = req.user;
  res.status(200).json({ success: true, message: 'User profile fetched successfully', data: { name, college, interests } });
});

// New post route
app.post('/newpost', async (req, res) => {
  const { post, user } = req.body;

  if (!post) {
    return res.status(400).json({ message: 'Enter a valid post' });
  }

  const newPost = new Post({ post, user });
  try {
    await newPost.save();
    res.status(201).json({ message: 'Post created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});
app.get('/allposts', async (req, res) => {
  try {
    // Fetch all posts from the database
    const posts = await Post.find().sort({ date: -1 });

    // Return the posts as a JSON response
    res.status(200).json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});
app.get('/api/posts/:postId/likes', fetchUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const liked = post.likedBy.includes(req.user.id); // Check if the user has liked the post
    res.json({ liked, likeCount: post.likeCount });
  } catch (error) {
    console.error('Error fetching like data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.get('/api/posts/:postId/allcomments', async (req, res) => {
  const { postId } = req.params; // Extract postId from req.params



  try {
    const post = await Post.findById(postId); // Find post by ID
    console.log(post)
    if (!post) {
      return res.status(404).send({ message: 'Post not found' }); // Handle case where post is not found
    }
   
    res.send(post.comments); // Send comments of the post
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).send({ message: 'Server error' }); // Handle errors (e.g., database issues)
  }
});

app.post('/api/posts/:postId/comments', fetchUser, async (req, res) => {
  try {
   
    const { postId } = req.params;
    const { comment } = req.body;

    const text=comment
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const newComment = {
      userId: req.user.id,
      username: req.user.name, // Assuming `fetchUser` middleware sets `req.user`
      text:text
    };

    post.comments.push(newComment);
    await post.save();

    res.status(201).json({ message: 'Comment added successfully', comment: newComment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/api/posts/like', fetchUser, async (req, res) => {
  const { postId, liked } = req.body;

  try {
    // Log incoming request data
    

    // Find the post by ID
    const post = await Post.findById(postId);
    if (!post) {
      
      return res.status(404).json({ message: 'Post not found' });
    }

    // Log the current likedBy and likeCount before making changes
   

    if (liked) {
      // Add the user to the likedBy array if not already present
      if (!post.likedBy.includes(req.user.id)) {
        post.likedBy.push(req.user.id);
        post.likeCount += 1;
      }
    } else {
      // Remove the user from the likedBy array
      post.likedBy = post.likedBy.filter((id) => id.toString() !== req.user.id.toString());
      post.likeCount -= 1;
    }

    // Log after updating


    // Save the updated post
    await post.save();

    // Send the updated like count back to the frontend
    res.json({ likeCount: post.likeCount });

  } catch (error) {
    console.error('Error updating like status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
const collaborationRequestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  skills: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
    required: true,
  },
  userId: {

    type:String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CollaborationRequest = mongoose.model('CollaborationRequest', collaborationRequestSchema);
app.post('/addcolabpost', fetchUser, async (req, res) => {
  try {
    const { title, description, skills, contact } = req.body;
  

    // Validate the fields
    if (!title || !description || !skills || !contact) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create a new collaboration request
    const newRequest = new CollaborationRequest({
      title,
      description,
      skills,
      contact,
      userId: req.user.name, // `authMiddleware` adds `user` to the request object
    });

    // Save to the database
    
    await newRequest.save();
    res.status(201).json({ message: 'Collaboration request added successfully', data: newRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/collaboration/allcolabposts', async (req, res) => {
  try {
    const posts = await CollaborationRequest.find().sort({ createdAt: -1 }); // Sort by newest first
   

    res.status(200).json({ data: posts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

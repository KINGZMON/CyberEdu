require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const app = express();
const pdf = require('pdfkit');

const port = process.env.PORT || 5000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

const uri = process.env.MONGO_URI

// MongoDB connection
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});


// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: uri,
        collectionName: 'sessions'
    }),

    cookie: { maxAge: 1000 * 60 * 60 * 5,   // 5 hours
        httpOnly: true,
        secure: false,
    }
}));


// Module Schema
const moduleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true },
    difficulty: { type: String, required: true },
    link: { type: String, required: true },
    maxPoints: { type: Number, required: true },
    averageScores: {
        type: Map,
        of: {
            totalScore: { type: Number, default: 0 },
            count: { type: Number, default: 0 },
            minScore: { type: Number, default: Infinity },
            maxScore: { type: Number, default: -Infinity }
        },
        default: {}
    }
});

const Module = mongoose.model('Module', moduleSchema);


// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['learner', 'tutor'], required: true },
    points: { type: Number, default: 0 },
    ageGroup: { type: String, required: false },
    consented: { type: Boolean, default: false },
    completedModules: [
        {
            moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
            pointsEarned: { type: Number, required: true }
        }
    ]
});

const User = mongoose.model('User', userSchema);



// Modules Route
app.get('/modules', async (req, res) => {
    try {
        const { search = '', difficulty = 'all' } = req.query;
        let query = {
            title: { $regex: search, $options: 'i' },
        };
        if (difficulty !== 'all') {
            query.difficulty = difficulty;
        }
        const modules = await Module.find(query);
        res.json(modules);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Signup Route
app.post('/signup', async (req, res) => {
    const { username, email, password, role, consented, ageGroup } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required.' });
    }

    if (role === 'learner' && (!username || (consented && !ageGroup))) {
        return res.status(400).json({ message: 'Learners must provide username and age group if consented.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            username: role === 'learner' ? username : null,
            email,
            password: hashedPassword,
            role,
            consented: role === 'learner' ? consented : null,
            ageGroup: role === 'learner' && consented ? ageGroup : null
        });

        await user.save();
        res.status(201).json({ message: 'User created successfully.' });
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === 11000) {
            res.status(400).json({ message: 'Email already in use.' });
        } else {
            res.status(500).json({ message: 'Internal server error.' });
        }
    }
});



// Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User does not exist' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Authentication successful
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        res.status(200).json({ message: 'Login successful', role: user.role  });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check Session Route
app.get('/check-session', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username, role: req.session.role });
    } else {
        res.json({ loggedIn: false });
    }
});

// Logout Route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    });
});


// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
}


// Mark module as completed
app.post('/complete-module', isLoggedIn, async (req, res) => {
    const { moduleSlug, score } = req.body;
    const userId = req.session.userId;

    if (!moduleSlug || score == null) {
        return res.status(400).json({ message: 'Module slug and score are required.' });
    }

    try {
        const module = await Module.findOne({ slug: moduleSlug });
        const user = await User.findById(userId);

        if (!module || !user) {
            return res.status(404).json({ message: 'Module or user not found.' });
        }

        // Check if the module is already completed
        const isModuleCompleted = user.completedModules.some(item => item.moduleId.equals(module._id));
        if (!isModuleCompleted) {
            if (user.role === 'learner') {
                user.completedModules.push({ moduleId: module._id, pointsEarned: score });
                user.points += score;

                // Update aggregated scores for the age group if consented
                if (user.consented && user.ageGroup) {
                    const ageGroupData = module.averageScores.get(user.ageGroup) || { 
                        totalScore: 0, 
                        count: 0, 
                        minScore: Infinity, 
                        maxScore: -Infinity 
                    };
                    
                    // Update stats
                    ageGroupData.totalScore += score;
                    ageGroupData.count += 1;

                    // Recalculate minScore and maxScore dynamically
                    const allLearnerScores = await User.aggregate([
                        { $match: { ageGroup: user.ageGroup, 'completedModules.moduleId': module._id } },
                        { $unwind: '$completedModules' },
                        { $match: { 'completedModules.moduleId': module._id } },
                        { $group: { _id: null, scores: { $push: '$completedModules.pointsEarned' } } }
                    ]);

                    if (allLearnerScores.length > 0) {
                        const scores = allLearnerScores[0].scores;
                        ageGroupData.minScore = Math.min(...scores);
                        ageGroupData.maxScore = Math.max(...scores);
                    }

                    module.averageScores.set(user.ageGroup, ageGroupData);
                    await module.save();
                }

                await user.save();
            } else if (user.role === 'tutor') {
                // Record completion for tutors without points or averages
                user.completedModules.push({ moduleId: module._id, pointsEarned: 0 });
            }
        }

        // Calculate percentile for learners if applicable
        let percentile = null;
        if (user.role === 'learner' && user.consented && user.ageGroup) {
            const ageGroupData = module.averageScores.get(user.ageGroup);

            if (ageGroupData && ageGroupData.count > 0) {
                const allLearnerScores = await User.aggregate([
                    { $match: { ageGroup: user.ageGroup, 'completedModules.moduleId': module._id } },
                    { $unwind: '$completedModules' },
                    { $match: { 'completedModules.moduleId': module._id } },
                    { $group: { _id: null, scores: { $push: '$completedModules.pointsEarned' } } }
                ]);

                if (allLearnerScores.length > 0) {
                    const scores = allLearnerScores[0].scores;

                    // Sort the scores to calculate the relative position
                    scores.sort((a, b) => a - b);
                    const totalLearners = scores.length;

                    // Find the rank of the current user's score
                    const rank = scores.filter(s => s > score).length; // Use `score` from request body
                    percentile = `Top ${Math.max(1, Math.round((rank / totalLearners) * 100))}%`;
                } else {
                    percentile = "No benchmark available";
                }
            } else {
                percentile = "No benchmark available";
            }
        }


        res.status(200).json({
            message: 'Module marked as completed.',
            maxPoints: module.maxPoints,
            percentile
        });
    } catch (err) {
        console.error('Error marking module as completed:', err);
        res.status(500).json({ message: 'Internal server error.', error: err });
    }
});



// Middleware to check if user is a learner
async function isLearner(req, res, next) {
    const userId = req.session.userId;
    try {
        const user = await User.findById(userId);
        if (user && user.role === 'learner') {
            return next();
        }
        res.status(403).json({ message: 'Forbidden' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
}

// Update points for activities (only for learners)
app.post('/update-points', isLoggedIn, isLearner, async (req, res) => {
    const { moduleSlug, points } = req.body;
    const userId = req.session.userId;

    try {
        const user = await User.findByIdAndUpdate(userId, { $inc: { points: points } });
        res.status(200).json({ message: 'Points updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Check if module is completed
app.get('/check-module-completion', isLoggedIn, async (req, res) => {
    const { moduleSlug } = req.query;
    const userId = req.session.userId;

    if (!moduleSlug) {
        return res.status(400).json({ message: 'Module slug is required' });
    }

    try {
        const module = await Module.findOne({ slug: moduleSlug });
        if (!module) {
            return res.status(404).json({ message: 'Module not found' });
        }

        const user = await User.findById(userId).populate('completedModules.moduleId');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const completed = user.completedModules.some(item => item.moduleId.equals(module._id));
        res.status(200).json({ completed });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error', error: err });
    }
});

// Reset module progress
app.post('/reset-module-progress', isLoggedIn, async (req, res) => {
    const { moduleSlug } = req.body;
    const userId = req.session.userId;

    try {
        const module = await Module.findOne({ slug: moduleSlug });
        const user = await User.findById(userId);

        if (!user || !module) {
            return res.status(404).json({ message: 'Module or user not found.' });
        }

        // Find the module in completedModules and remove it
        const completedModuleIndex = user.completedModules.findIndex(item => item.moduleId.equals(module._id));
        if (completedModuleIndex !== -1) {
            const pointsToDeduct = user.completedModules[completedModuleIndex].pointsEarned;
            user.completedModules.splice(completedModuleIndex, 1);
            user.points = Math.max(user.points - pointsToDeduct, 0);

            // Adjust age group averages
            if (user.consented && user.ageGroup) {
                const ageGroupData = module.averageScores.get(user.ageGroup) || { totalScore: 0, count: 0, minScore: Infinity, maxScore: -Infinity };

                // Deduct score and update count
                ageGroupData.totalScore = Math.max(0, ageGroupData.totalScore - pointsToDeduct);
                ageGroupData.count = Math.max(0, ageGroupData.count - 1);

                if (ageGroupData.count > 0) {
                    // Fetch remaining scores dynamically
                    const remainingScores = await User.aggregate([
                        { $match: { ageGroup: user.ageGroup, 'completedModules.moduleId': module._id } },
                        { $unwind: '$completedModules' },
                        { $match: { 'completedModules.moduleId': module._id } },
                        { $group: { _id: null, scores: { $push: '$completedModules.pointsEarned' } } }
                    ]);

                    if (remainingScores.length > 0) {
                        const scores = remainingScores[0].scores;
                        ageGroupData.minScore = Math.min(...scores);
                        ageGroupData.maxScore = Math.max(...scores);
                    }
                } else {
                    // Set age group values to defaults
                    ageGroupData.totalScore = 0;
                    ageGroupData.count = 0;
                    ageGroupData.minScore = Infinity;
                    ageGroupData.maxScore = -Infinity;
                }

                module.averageScores.set(user.ageGroup, ageGroupData);
                await module.save();
            }

            await user.save();

            return res.status(200).json({ message: 'Module progress has been reset and points deducted.' });
        } else {
            return res.status(404).json({ message: 'Module not found in completed modules.' });
        }
    } catch (err) {
        console.error('Error resetting module progress:', err);
        return res.status(500).json({ message: 'Internal server error.', error: err });
    }
});

const updateMinMaxScores = async () => {
    try {
        // Fetch all modules
        const modules = await Module.find();

        for (const module of modules) {
            for (const [ageGroup, data] of module.averageScores.entries()) {
                if (data.count > 0) {
                    // Fetch remaining scores dynamically
                    const remainingScores = await User.aggregate([
                        { $match: { ageGroup, 'completedModules.moduleId': module._id } },
                        { $unwind: '$completedModules' },
                        { $match: { 'completedModules.moduleId': module._id } },
                        { $group: { _id: null, scores: { $push: '$completedModules.pointsEarned' } } }
                    ]);

                    if (remainingScores.length > 0) {
                        const scores = remainingScores[0].scores;
                        data.minScore = Math.min(...scores);
                        data.maxScore = Math.max(...scores);
                    } else {
                        // Reset to defaults if no scores remain
                        data.minScore = Infinity;
                        data.maxScore = -Infinity;
                    }

                    // Update the map with recalculated values
                    module.averageScores.set(ageGroup, data);
                }
            }

            // Save the updated module
            await module.save();
        }
    } catch (err) {
        console.error('Error updating min and max scores:', err);
    }
};

// Run the updater every 3 seconds
setInterval(updateMinMaxScores, 3000);


// Additional route to serve user data
app.get('/user-data', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate('completedModules.moduleId');
        const completedModules = user.completedModules.map(cm => ({
            title: cm.moduleId.title,
            pointsEarned: cm.pointsEarned,
            slug: cm.moduleId.slug,
            maxPoints: cm.moduleId.maxPoints
        }));

        const allModules = await Module.find();
        const recommendedModules = allModules.filter(module => 
            !user.completedModules.some(cm => cm.moduleId.equals(module._id))
        ).slice(0, 5).map(module => ({ title: module.title, slug: module.slug }));

        res.json({
            username: user.username,
            points: user.points,
            completedModules,
            recommendedModules
        });

    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Get leaderboard data
app.get('/leaderboard-data', async (req, res) => {
    try {
        const users = await User.find({ role: 'learner' }).sort({ points: -1 }).limit(15);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Internal server error', error: err });
    }
});



// Tutor Learner Schema
const tutorLearnerSchema = new mongoose.Schema({
    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    learnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const TutorLearner = mongoose.model('TutorLearner', tutorLearnerSchema);

// Add learner route
app.post('/add-learner', async (req, res) => {
    const { email } = req.body;
    try {
        const learner = await User.findOne({ email, role: 'learner' });
        if (!learner) {
            return res.status(404).json({ message: 'Learner not found' });
        }

        const existingLink = await TutorLearner.findOne({ tutorId: req.session.userId, learnerId: learner._id });
        if (existingLink) {
            return res.status(400).json({ message: 'Learner already added' });
        }

        const newLink = new TutorLearner({ tutorId: req.session.userId, learnerId: learner._id });
        await newLink.save();

        res.status(200).json({ username: learner.username, points: learner.points, id: learner._id, email: learner.email });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get learners route
app.get('/get-learners', async (req, res) => {
    try {
        const tutorLearners = await TutorLearner.find({ tutorId: req.session.userId }).populate('learnerId');
        const learners = tutorLearners.map(es => ({
            username: es.learnerId.username,
            points: es.learnerId.points,
            id: es.learnerId._id,
            email: es.learnerId.email
        }));
        res.status(200).json({ learners });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete learner route
app.delete('/delete-learner', async (req, res) => {
    const { id } = req.body;
    try {
        const link = await TutorLearner.findOneAndDelete({ tutorId: req.session.userId, learnerId: id });
        if (!link) {
            return res.status(404).json({ message: 'Learner not linked to tutor' });
        }
        res.status(200).json({ message: 'Learner removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get learner progress route
app.get('/get-learner-progress', async (req, res) => {
    const { id } = req.query;
    console.log(`Fetching progress for learner ID: ${id}`); // Log learner ID

    if (!id) {
        return res.status(400).json({ message: 'Learner ID is required.' });
    }

    try {
        const learner = await User.findById(id).populate('completedModules.moduleId');
        if (!learner) {
            console.log('Learner not found.'); // Log if learner is missing
            return res.status(404).json({ message: 'Learner not found.' });
        }

        const modules = learner.completedModules.map(cm => {
            if (cm.moduleId) {
                return {
                    title: cm.moduleId.title,
                    points: cm.pointsEarned,
                    maxPoints: cm.moduleId.maxPoints,
                };
            }
            return null;
        }).filter(Boolean);

        console.log('Fetched modules:', modules); // Log fetched modules
        res.status(200).json({ modules });
    } catch (error) {
        console.error('Error fetching learner progress:', error); // Log error
        res.status(500).json({ message: 'Server error occurred while fetching progress.', error });
    }
});



// Report generation route
app.get('/generate-report', isLoggedIn, async (req, res) => {
    const userId = req.query.userId || req.session.userId;
    try {
        const user = await User.findById(userId).populate('completedModules.moduleId');
        
        const doc = new pdf();
        const filename = `Report_${user.username}.pdf`;
        
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');
        
        doc.pipe(res);
        
        doc.font('Times-Roman');

        // Title
        doc.fontSize(14).font('Times-Bold').text(user.username.toUpperCase() + ' PROGRESS REPORT', { align: 'center' });
        doc.moveDown();

        // User Info
        doc.fontSize(12).font('Times-Bold').text('Email: ', { continued: true })
            .font('Times-Roman').text(user.email);
        doc.fontSize(12).font('Times-Bold').text('Username: ', { continued: true })
            .font('Times-Roman').text(user.username);
        doc.fontSize(12).font('Times-Bold').text('Report Date: ', { continued: true })
            .font('Times-Roman').text(new Date().toLocaleDateString('en-GB'));
        doc.moveDown();

        // Progress Overview
        const totalPoints = user.points;
        const modulesCompleted = user.completedModules.length;

        const totalPointsAchievable = user.completedModules.reduce((sum, cm) => sum + cm.moduleId.maxPoints, 0);
        const averageGrade = totalPointsAchievable > 0 
            ? ((user.points / totalPointsAchievable) * 10).toFixed(1) 
            : 0;


        doc.fontSize(12).font('Times-Bold').text('Progress Overview', { underline: true} );
        doc.fontSize(12).font('Times-Bold').text('Total Points Earned: ', { continued: true })
            .font('Times-Roman').text(totalPoints);
        doc.fontSize(12).font('Times-Bold').text('Modules Completed: ', { continued: true })
            .font('Times-Roman').text(modulesCompleted);
        doc.fontSize(12).font('Times-Bold').text('Average Grade: ', { continued: true })
            .font('Times-Roman').text(`${averageGrade}`);
        doc.moveDown();

        // Module Details
        doc.fontSize(12).font('Times-Bold').text('Module Details', { underline: true} );
        user.completedModules.forEach(cm => {
            doc.fontSize(12).font('Times-Bold').text('Module Title: ', { continued: true })
                .font('Times-Roman').text(cm.moduleId.title);
            doc.fontSize(12).font('Times-Bold').text('Difficulty: ', { continued: true })
                .font('Times-Roman').text(cm.moduleId.difficulty);
            doc.fontSize(12).font('Times-Bold').text('Score: ', { continued: true })
                .font('Times-Roman').text(`${cm.pointsEarned}/${cm.moduleId.maxPoints}`);
            doc.moveDown();
        });
        doc.moveDown();

        // Recommended Modules
        const allModules = await Module.find();
        const recommendedModules = allModules.filter(module => 
            !user.completedModules.some(cm => cm.moduleId.equals(module._id))
        ).slice(0, 5);

        doc.fontSize(12).font('Times-Bold').text('Recommended Modules', { underline: true} );
        recommendedModules.forEach(module => {
            doc.fontSize(12).font('Times-Roman').text(module.title);
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});



// Fetch Account Information
app.get('/account-info', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            username: user.username || null, // Null for tutors
            email: user.email,
            role: user.role
        });
    } catch (err) {
        console.error('Error fetching account info:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Update Account Information
app.post('/update-account-info', isLoggedIn, async (req, res) => {
    const { username, email } = req.body;
    const userId = req.session.userId;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    if (username && (username.length < 3 || username.length > 20)) {
        return res.status(400).json({ message: 'Username must be between 3 and 20 characters.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    try {
        // Only update username if it is provided
        const updateData = { email };
        if (username) {
            updateData.username = username;
        }

        await User.findByIdAndUpdate(userId, updateData);
        res.status(200).json({ message: 'Information updated successfully.' });
    } catch (err) {
        console.error('Error updating account info:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// Update Password Route
app.post('/update-password', isLoggedIn, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// Delete Account Route
app.delete('/delete-account', isLoggedIn, async (req, res) => {
    const userId = req.session.userId;

    try {
        // Find the user and their completed modules
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Adjust module average scores for completed modules
        for (const completedModule of user.completedModules) {
            const module = await Module.findById(completedModule.moduleId);
            if (module && user.consented && user.ageGroup) {
                const ageGroupData = module.averageScores.get(user.ageGroup);
                if (ageGroupData) {
                    // Adjust the total score and count
                    ageGroupData.totalScore -= completedModule.pointsEarned;
                    ageGroupData.count -= 1;

                    // If no users remain in this age group, reset scores
                    if (ageGroupData.count <= 0) {
                        ageGroupData.totalScore = 0;
                        ageGroupData.count = 0;
                        ageGroupData.minScore = Infinity;
                        ageGroupData.maxScore = -Infinity;
                    } else {
                        // Recalculate min and max scores dynamically
                        const remainingScores = await User.aggregate([
                            { $match: { ageGroup: user.ageGroup, 'completedModules.moduleId': module._id } },
                            { $unwind: '$completedModules' },
                            { $match: { 'completedModules.moduleId': module._id } },
                            { $group: { _id: null, scores: { $push: '$completedModules.pointsEarned' } } }
                        ]);

                        if (remainingScores.length > 0) {
                            const scores = remainingScores[0].scores;
                            ageGroupData.minScore = Math.min(...scores);
                            ageGroupData.maxScore = Math.max(...scores);
                        } else {
                            ageGroupData.minScore = Infinity;
                            ageGroupData.maxScore = -Infinity;
                        }
                    }

                    // Save the updated module
                    module.averageScores.set(user.ageGroup, ageGroupData);
                    await module.save();
                }
            }
        }

        // Delete the user
        await User.findByIdAndDelete(userId);

        // Remove associated tutor-learner links
        await TutorLearner.deleteMany({ $or: [{ tutorId: userId }, { learnerId: userId }] });

        // Destroy session and clear cookies
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ message: 'Failed to delete account.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Account deleted successfully and scores removed.' });
        });
    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// Route to fetch popular modules
app.get('/popular-modules', async (req, res) => {
    try {
        const modules = await Module.aggregate([
            // Lookup completed modules for consented and non-consented learners
            {
                $lookup: {
                    from: 'users', // Assuming the collection for users is named 'users'
                    let: { moduleId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: ['$$moduleId', '$completedModules.moduleId']
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                consentedCount: {
                                    $sum: {
                                        $cond: [
                                            { $and: ['$consented', { $ne: ['$consented', null] }] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                nonConsentedCount: {
                                    $sum: {
                                        $cond: [
                                            { $or: [{ $eq: ['$consented', false] }, { $eq: ['$consented', null] }] },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    as: 'completionData'
                }
            },
            // Add fields for total completed count
            {
                $addFields: {
                    completedCount: {
                        $sum: {
                            $map: {
                                input: '$completionData',
                                as: 'data',
                                in: { $add: ['$$data.consentedCount', '$$data.nonConsentedCount'] }
                            }
                        }
                    }
                }
            },
            // Select only necessary fields
            {
                $project: {
                    title: 1,
                    slug: 1,
                    difficulty: 1,
                    completedCount: 1
                }
            },
            // Sort by completed count in descending order
            { $sort: { completedCount: -1 } },
            // Limit to top 3 modules
            { $limit: 3 }
        ]);

        res.json(modules);
    } catch (error) {
        console.error('Error fetching popular modules:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});





/* ==== SERVE STATIC FILES ==== */
// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ==== Serve Views HTML files ==== //
app.get('/search-modules.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'search-modules.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/leaderboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'leaderboard.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/learner-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'learner-dashboard.html'));
});

app.get('/tutor-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tutor-dashboard.html'));
});

app.get('/contact.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/faq.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'faq.html'));
});

app.get('/privacy-policy.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'privacy-policy.html'));
});

app.get('/manage-account.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'manage-account.html'));
});


// ==== Serve Modules HTML files ==== //
app.get('/modules/intro-to-cyber.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'modules', 'intro-to-cyber.html'));
});
app.get('/modules/network-basics.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'modules', 'network-basics.html'));
});
app.get('/modules/advanced-malware-analysis.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'modules', 'advanced-malware-analysis.html'));
});

app.listen(port, () => {
    console.log(`CyberEdu app is running at http://localhost:${port}`);
});
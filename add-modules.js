const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
    addModules();
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

// Define the Module schema with averageScores
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
            count: { type: Number, default: 0 }
        },
        default: {}
    }
});

const Module = mongoose.model('Module', moduleSchema);

// Modules to add
const modules = [
    {
        title: 'Introduction to Cybersecurity',
        slug: 'intro-to-cyber',
        difficulty: 'Easy',
        link: '/modules/intro-to-cyber.html',
        maxPoints: 8
    },
    {
        title: 'Network Security Basics',
        slug: 'network-basics',
        difficulty: 'Medium',
        link: '/modules/network-basics.html',
        maxPoints: 20
    },
    {
        title: 'Advanced Malware Analysis',
        slug: 'advanced-malware-analysis',
        difficulty: 'Hard',
        link: '/modules/advanced-malware-analysis.html',
        maxPoints: 0
    }
];

async function addModules() {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await Module.insertMany(modules, { session });
        await session.commitTransaction();
        console.log('Modules added successfully');
    } catch (err) {
        await session.abortTransaction();
        console.error('Error adding modules', err);
    } finally {
        session.endSession();
        mongoose.connection.close();
    }
}
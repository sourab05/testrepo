require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

// Configure Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// Function to analyze code using Gemini
const analyzeCode = async (code) => {
    try {
        const response = await model.generateContent(`Review the following code and provide detailed comments:\n\n${code}`);
        
        // Check if the response contains text, otherwise, return a default comment
        if (response && response.text && response.text.trim() !== '') {
            return response.text; // Return the generated comments
        } else {
            return 'No detailed comments provided by the AI model.'; // Fallback comment if no review is returned
        }
    } catch (error) {
        console.error('Error analyzing code with Gemini:', error.message);
        return 'Error analyzing code.'; // In case of an error
    }
};

// Fetch the latest pull request
const fetchLatestPR = async () => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
        return response.data[0]; // Returns the latest PR
    } catch (error) {
        console.error('Error fetching PR:', error.message);
    }
};

// Fetch files changed in a pull request
const fetchFilesInPR = async (prNumber) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/files`, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching PR files:', error.message);
    }
};

// Post comments on a pull request
const postComment = async (prNumber, body) => {
    try {
        await axios.post(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${prNumber}/comments`, 
        { body }, 
        {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
    } catch (error) {
        console.error('Error posting comment:', error.message);
    }
};

// Approve the pull request
const approvePR = async (prNumber) => {
    try {
        await axios.post(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews`, 
        { event: "APPROVE" }, 
        {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
    } catch (error) {
        console.error('Error approving PR:', error.message);
    }
};

// Main workflow
const reviewPullRequest = async () => {
    try {
        // Fetch the latest PR
        const pr = await fetchLatestPR();
        if (!pr) {
            console.log('No open pull requests found.');
            return;
        }

        console.log(`Reviewing PR: #${pr.number} - ${pr.title}`);

        // Fetch files in the PR
        const files = await fetchFilesInPR(pr.number);
        if (!files || files.length === 0) {
            console.log('No files to review.');
            return;
        }

        let hasIssues = false;

        // Analyze each file
        for (const file of files) {
            console.log(`Analyzing file: ${file.filename}`);
            const comments = await analyzeCode(file.patch);
            if (comments) {
                hasIssues = true;
                await postComment(pr.number, `Comments for ${file.filename}:\n${comments}`);
                console.log(`Comments added for file: ${file.filename}`);
            }
        }

        // Approve the PR if no issues are found
        if (!hasIssues) {
            await approvePR(pr.number);
            console.log('PR approved.');
        } else {
            console.log('Issues found. PR not approved.');
        }
    } catch (error) {
        console.error('Error reviewing PR:', error.message);
    }
};

// Run the application
reviewPullRequest();

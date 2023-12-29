const dotenv = require('dotenv');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const express = require('express');
const router = require("express").Router();
const axios = require('axios');
const { User } = require("../models/user.js");
const multer = require('multer');
const upload = multer();
const fs = require('fs');
const string = require('string'); // Import the 'string' library
const FormData = require('form-data'); // Import the FormData library
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);


router.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per `window` (here, per minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.use(apiLimiter);

let isProcessing = false;
let requestQueue = [];

router.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from CodeX!'
  });
});

router.post('/api/add/chat-session', async (req, res) => {
    const userEmail = req.header('User-Email');
  
    try {
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        const sessionId = new mongoose.Types.ObjectId().toString();
        user.chatSessions.push({ sessionId, messages: [] });
        await user.save();
        res.status(201).json({ sessionId });
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error adding chat session:', error);
      res.status(500).send('Error adding chat session');
    }
  });

  router.post('/api/send/chat', upload.single('file'), async (req, res) => {
    const userEmail = req.header('User-Email');
    const { text, sessionId, conversationHistory } = req.body; // Include conversationHistory

    try {
        const user = await User.findOne({ email: userEmail });

        if (user) {
            const session = user.chatSessions.find(session => session.sessionId === sessionId);

            if (session) {
                const form = new FormData();
                if (req.file) {
                    const fileBuffer = req.file.buffer;
                    form.append('file', fileBuffer, {
                        filename: req.file.originalname,
                        contentType: req.file.mimetype,
                    });
                    // Store user's file message
                    session.messages.push({ text: req.file.originalname, isBot: false, isFile: true });
                } else {
                    // Store user's text message
                    session.messages.push({ text: text, isBot: false });
                }

                form.append('prompt', text); // Add other form fields as needed
                const headers = form.getHeaders(); // Get the headers for the multipart request

                const pythonResponse = await axios.post('http://20.169.49.29:6000/chat', form, { headers });

                const botResponse = pythonResponse.data.response;
                // Store bot's response
                session.messages.push({ text: botResponse, isBot: true });

                await user.save(); // Save the updated user document

                res.status(200).json({ bot: botResponse });
            } else {
                res.status(404).send('Chat session not found');
            }
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error sending chat message:', error);
        res.status(500).send('Error sending chat message');
    }
});


router.get('/api/get/chat-sessions', async (req, res) => {
    const userEmail = req.header('User-Email');
  
    try {
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        const chatSessions = user.chatSessions.map((session) => ({
          sessionId: session.sessionId,
          messages: session.messages,
        }));
        res.status(200).json(chatSessions);
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      res.status(500).send('Error fetching chat sessions');
    }
  });
// Endpoint to save chat messages
router.post('/api/create/chat-session', async (req, res) => {
    const userEmail = req.header('User-Email');
  
    try {
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        const sessionId = new mongoose.Types.ObjectId().toString();
        user.chatSessions.push({ sessionId, messages: [] });
        await user.save();
        res.status(201).json({ sessionId });
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).send('Error creating chat session');
    }
  });
  
  // Endpoint to delete a chat session
  router.delete('/api/delete/chat-session/:sessionId', async (req, res) => {
    const userEmail = req.header('User-Email');
    const sessionId = req.params.sessionId;
  
    try {
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        const sessionIndex = user.chatSessions.findIndex(
          (session) => session.sessionId === sessionId
        );
        if (sessionIndex !== -1) {
          user.chatSessions.splice(sessionIndex, 1);
          await user.save();
          res.status(204).send();
        } else {
          res.status(404).send('Chat session not found');
        }
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
      res.status(500).send('Error deleting chat session');
    }
  });
  
  // Endpoint to clear messages in a chat session
  router.delete('/api/clear/chat-session/:sessionId', async (req, res) => {
    const userEmail = req.header('User-Email');
    const sessionId = req.params.sessionId;
  
    try {
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        const session = user.chatSessions.find(
          (session) => session.sessionId === sessionId
        );
        if (session) {
          session.messages = [];
          await user.save();
          res.status(204).send();
        } else {
          res.status(404).send('Chat session not found');
        }
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error clearing chat session:', error);
      res.status(500).send('Error clearing chat session');
    }
  });

router.post('/', async (req, res) => {
  requestQueue.push({ req, res });
  console.log("Request added to queue. Queue length:", requestQueue.length);
  processQueue();
});

function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    console.log("Currently processing or no requests in queue.");
    return;
  }

  isProcessing = true;
  const { req, res } = requestQueue.shift();

  processRequest(req, res);
}

async function processRequest(req, res) {
    try {
      let prompt = req.body.prompt;
  
      // Call the Python API endpoint
      const response = await axios.post('http://localhost:5000/chat', { user_input: prompt });


      const botResponse = response.data.response; // Get response from Python API
      console.log("Bot Response:", botResponse);

      res.status(200).send({
        bot: botResponse
      });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).send(error.message || 'Something went wrong');
    } finally {
      isProcessing = false;
      setTimeout(processQueue, 1000); // Wait 1 second before processing the next request
    }
}

module.exports = router;

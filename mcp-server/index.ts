
import express from 'express';
import crypto from 'crypto';
import { analyzeProject } from './analyzer';

const app = express();
const PORT = 3001;

// IMPORTANT: Replace 'supersecret' with a real secret and store it securely (e.g., in environment variables)
const GITHUB_WEBHOOK_SECRET = 'supersecret';

// Middleware to validate the webhook signature
const verifySignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return res.status(401).send('Signature required');
  }

  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).send('Invalid signature');
  }

  next();
};

app.use(express.json());

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.post('/webhook/github', (req, res) => {
  // We can add signature verification later for security
  console.log('Webhook received!');
  
  const eventType = req.headers['x-github-event'] as string;
  console.log(`Event type: ${eventType}`);

  if (eventType === 'push') {
    console.log('Push event detected. Starting project analysis...');
    // The project to analyze is the root directory
    analyzeProject('.').then(analysisResult => {
      console.log('Analysis complete.');
      // In a real application, we would store or process this result.
    }).catch(err => {
      console.error('Analysis failed.');
    });
  }

  res.status(200).send('Webhook processed');
});

app.listen(PORT, () => {
  console.log(`Model Context Provider server listening on http://localhost:${PORT}`);
});

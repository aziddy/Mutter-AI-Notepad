import { getLlama, LlamaChatSession } from "node-llama-cpp";
import path from "path";
import { fileURLToPath } from 'url';

// https://github.com/withcatai/node-llama-cpp

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// const modelPath = path.join(__dirname, "..", "models", "qwen3-0.6b", "qwen3-0.6b.q4_0.gguf");
const modelPath = path.join(__dirname, "..", "models", "qwen3-0.6b", "qwen3-0.6b.q8_0.gguf");

console.log("Model path:", modelPath);

// Check if model file exists
import fs from 'fs';
if (!fs.existsSync(modelPath)) {
    console.error("Model file not found at:", modelPath);
    console.log("Available files in models directory:");
    const modelsDir = path.join(__dirname, "..", "models");
    if (fs.existsSync(modelsDir)) {
        console.log(fs.readdirSync(modelsDir, { recursive: true }));
    }
    process.exit(1);
}

console.log("Model file found, initializing LLM...");

// Initialize the LLM with node-llama-cpp
const llama = await getLlama();
const model = await llama.loadModel({
    temperature: 0.3,
    modelPath: modelPath,
    contextSize: 8192,
    threads: 4,
    useMlock: false,
    useMmap: true,

});

const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

console.log("LLM loaded successfully!");

// Test a simple completion
try {
    const response = await session.prompt("summarize the following meeting transcript [10:00 AM]: Alright, let’s get started. Today’s meeting is mainly to align on the timeline for the NovaOne launch and finalize any last-minute changes. Can we start with an engineering update? [10:01 AM]: Sure. Backend is 98% complete—we’re just running load tests on the payment gateway. Frontend is on track too; we had a minor issue with the dashboard responsiveness, but a fix is being pushed by end of day. [10:03 AM]: Yes, the layout bug on tablets was resolved in staging and just needs review. [10:04 AM]: Great. So we’re still on for code freeze by next Tuesday? [10:05 AM]: Yes, unless QA finds anything major during this week’s regression testing. [10:06 AM]: Okay, noted. Can we get an update from marketing? [10:07 AM]: We’re almost there. The teaser campaign goes live tomorrow, and press outreach is scheduled for Monday. Landing page copy is finalized—we’re just waiting on the new visuals. [10:08 AM]: Those assets will be ready by 3 PM today. A ping will go out once they’re in the shared drive. [10:09 AM]: Good to hear. Quick note—let’s make sure our messaging doesn’t oversell the AI features. We want to avoid confusion around what’s automated vs. manual in version 1.0. [10:10 AM]: Absolutely. The language has been adjusted to focus on “AI-assisted,” not “fully autonomous.” [10:11 AM]: Perfect. One last thing: we’ll need volunteers for the internal demo on Friday. Any takers? [10:12 AM]: I can do a walkthrough of the dashboard. [10:13 AM]: I’ll cover the user flow and UI highlights. [10:13 AM]: Thanks. That’s it for today unless anyone has blockers or questions? [10:14 AM]: No issues raised. [10:15 AM]: Alright, meeting adjourned. A summary with action items will be sent out shortly. Thanks, everyone!");
    console.log("Response:", response);

    const response2 = await session.prompt("whens the due date?");
    console.log("Response2:", response2);
} catch (error) {
    console.error("Error during completion:", error);
}

// models/qwen3-0.6b/qwen3-0.6b.q4_0.gguf
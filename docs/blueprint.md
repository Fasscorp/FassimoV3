# **App Name**: GeminiFlow

## Core Features:

- Communication Agent: Implement a Communication Agent to handle inputs from various channels (email, WhatsApp, voice, chat interface) and generate reports. The communication agent uses an LLM to decide how to best respond or report after actions are taken by other agents. The agent decides when to send notifications or provide status updates.
- Executive Agent: Develop an Executive Agent to decompose requests, prepare prompts for sub-agents, and verify their outputs before sending final actions to execution sub-agents, serving as an orchestration tool.
- Specialized Sub-Agents: Create specialized Sub-Agents with access to ModelContextProtocol tools to perform specific tasks like data retrieval, analysis, and execution, enabling focused functionalities.
- Web Interface: Develop a web interface featuring a text area for user input, a send button, and a conversation history panel for seamless interaction with the Communication Agent.

## Style Guidelines:

- Neutral white or light gray for a clean background.
- Darker gray or black for text and important elements to provide contrast.
- Teal (#581792) to highlight interactive elements and calls to action, providing a modern touch.
- Clean and modern sans-serif font for readability.
- Use a single-page layout with a central chat window for a streamlined user experience.
- Use minimalistic and clear icons to represent different actions and statuses.
- Subtle animations for transitions and loading states to enhance user experience without being distracting.

## Original User Request:
I want to create a multiagent AI system with the gemini API

The system should have 1 agent who is responsible for communication
Receiving infromation by email, whatsapp message and voice, as well as in the chat interface.

He should then pass the information to an executive agent responsible for breaking it down and preparing prompts for the other sub-agents who will perform the task.

The sub-agents will have modelcontextprotocol resources to fetch data and tools they need to complete the task like getting the date.
Then once they do the task it will go back to the executive agent for verification

And once ready he will send it to sub-agents connected to modelcontextprotocol tools that will execute it.

Once the job is done the communication agent should respond and provide a report

the interface should be just a simple texarea to talk to the communication agent with an input text field and a send button.

The interface should have a sleek modern design.

Technologies
Use https://github.com/modelcontextprotocol/typescript-sdk
Use https://astro.build/
Choose the best database that would work on firebase.

Keep a flat and predictable folder structure

Here is a full requirements document
Project Requirements Document: Multi-Agent AI System Using Gemini API

1. Project Overview
The goal of this project is to develop a modular, multi-agent AI system leveraging the Gemini API and the ModelContextProtocol TypeScript SDK. The system will streamline end-to-end task execution by ingesting inputs across multiple channels, delegating tasks among specialized agents, and providing automated, verified outputs back to users.

2. Objectives

Implement a Communication Agent for multi-channel input and user interaction.

Develop an Executive Agent to orchestrate tasks, prepare prompts, and verify sub-agent outputs.

Create Sub-Agents with focused responsibilities (e.g., data retrieval, analysis, execution) and access to ModelContextProtocol tools.

Ensure robust handoff and feedback loops between agents for accuracy and reliability.

Build a sleek, modern web interface for user communication via text, email, WhatsApp, and voice.

Integrate the ModelContextProtocol TypeScript SDK (https://github.com/modelcontextprotocol/typescript-sdk) for tool access.

3. System Architecture

User <--> Communication Agent <--> Executive Agent
                                   |--> Sub-Agent A (Data Fetch)
                                   |--> Sub-Agent B (Analysis)
                                   |--> Sub-Agent C (Execution)
                                   \--> [Verification Loop] <--> Executive Agent

4. Agent Definitions & Responsibilities

4.1 Communication Agent

Input Channels: Email, WhatsApp, Voice (speech-to-text), Chat interface

Tasks:

Receive and parse incoming messages

Normalize and forward structured information to Executive Agent

Receive final output and deliver responses back to users

Generate execution reports

4.2 Executive Agent

Tasks:

Receive structured inputs from Communication Agent

Decompose requests into discrete subtasks

Generate prompts for Sub-Agents

Validate and verify Sub-Agent results

Coordinate final execution steps via execution sub-agents

4.3 Sub-Agents

Capabilities:

Use ModelContextProtocol SDK to fetch data (e.g., dates, external APIs, databases)

Perform specialized operations (e.g., data analysis, scheduling, document generation)

Return structured outputs and metadata to Executive Agent for verification

Examples:

Data Retrieval Agent: Fetch current date/time, user-specific data, or external resources

Processing Agent: Analyze, summarize, or transform retrieved data

Execution Agent: Use context tools to enact changes (e.g., send emails, schedule events)

5. Workflow & Communication Flow

User Request: User sends a message via chat/email/WhatsApp/voice.

Communication Agent: Parses and normalizes input; forwards to Executive Agent.

Executive Agent: Breaks down the request; creates prompts for Sub-Agents.

Sub-Agents: Use ModelContextProtocol resources to perform tasks; return results.

Verification Loop: Executive Agent reviews and validates Sub-Agent outputs.

Execution: Executive Agent instructs execution sub-agents to carry out final actions.

Reporting: Communication Agent compiles a report and sends it back to the user.

6. Technical Requirements

6.1 APIs & SDKs

Gemini API for core LLM capabilities

ModelContextProtocol TypeScript SDK for resource/tool access

6.2 Infrastructure

Firebase Cloud Functions: Host each agent as a serverless function for horizontal scalability and low-latency event-driven triggers.

Firebase Firestore: Store conversation state, agent metadata, task queues, and logs in a managed, scalable NoSQL database.

Firebase Authentication: Secure user interactions and agent API endpoints with built-in OAuth2 / Firebase Auth (email, phone, social providers).

Firebase Hosting: Deploy the single-page chat interface with global CDN distribution and automatic SSL.

Firebase Cloud Messaging: Enable real-time push notifications for status updates or alerts (optional).

6.3 Integration Points Integration Points

WhatsApp: Twilio or WhatsApp Business API

Voice: Web Speech API or third-party speech-to-text service

Chat Interface: Custom web UI with WebSocket or REST API endpoints

7. User Interface Requirements

Layout: Single-page application (SPA) with a central chat window

Components:

Text area for user input

"Send" button

Conversation history panel

Design:

Sleek, modern aesthetic with minimalistic styling

Responsive design for desktop and mobile

Accessibility compliance (WCAG 2.1)

9. Testing & Validation

Unit Tests: Cover key agent functions and workflows

Integration Tests: Validate end-to-end message flows

User Acceptance Testing: Simulated multi-channel interactions

Milestone

Requirements Finalization

Prototype: Communication UI

Agent Framework Setup

Sub-Agent Development

Integration & Testing

Security & Compliance Audit

Deployment & Go-Live

11. Deliverables

Detailed requirements document (this document)

Agent microservices codebase (TypeScript)

Web-based chat interface

Deploy on Firebase

Make sure every function is well commented
  
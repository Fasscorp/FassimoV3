
'use server';
/**
 * @fileOverview Defines the Get Tasks flow using Genkit.
 * This flow retrieves the list of tasks from a persistent store (e.g., Firestore).
 *
 * - getTasks - Function to invoke the get tasks flow.
 * - GetTasksInput - Input type (currently empty, might include filtering options later).
 * - GetTasksOutput - Output type containing the list of tasks.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the Task schema
const TaskSchema = z.object({
    id: z.string().describe('Unique identifier for the task.'),
    description: z.string().describe('The description of the task.'),
    priority: z.enum(['high', 'medium', 'low']).describe('The priority of the task.'),
    dueDate: z.string().optional().describe('Optional due date in ISO 8601 format.'),
    completed: z.boolean().describe('Whether the task is completed.'),
});
export type Task = z.infer<typeof TaskSchema>;


// Define the input schema for getting tasks (currently empty, add filters later if needed)
const GetTasksInputSchema = z.object({
    // Example: filter: z.enum(['all', 'pending', 'completed']).optional().describe('Filter tasks by status.'),
    // Example: userId: z.string().optional().describe('ID of the user whose tasks to fetch.')
}).describe('Input for fetching tasks. Currently accepts no parameters.');
export type GetTasksInput = z.infer<typeof GetTasksInputSchema>;

// Define the output schema for the get tasks flow
const GetTasksOutputSchema = z.object({
  tasks: z.array(TaskSchema).describe('The list of tasks retrieved.'),
});
export type GetTasksOutput = z.infer<typeof GetTasksOutputSchema>;

// --- Mock Persistent Storage (Replace with Firestore in production) ---
// This array will persist across requests *within the same server instance*.
// It will be lost on server restarts.
// Keep it internal to the module, don't export it.
let mockTaskDatabase: Task[] = [];
console.log("[Task Flows] Initialized mock task database (in-memory).");
// --------------------------------------------------------------------

/**
 * Retrieves the list of tasks.
 * In a real application, this would interact with a database (e.g., Firestore).
 * @param input Filtering options (currently none).
 * @returns The list of tasks.
 */
export async function getTasks(input: GetTasksInput): Promise<GetTasksOutput> {
  console.log("[getTasks] Invoked with input:", input);
  // In a real app, replace this mock flow with actual database interaction.
  return getTasksFlow(input);
}

// Define the Genkit flow for getting tasks
const getTasksFlow = ai.defineFlow<
  typeof GetTasksInputSchema,
  typeof GetTasksOutputSchema
>(
  {
    name: 'getTasksFlow',
    inputSchema: GetTasksInputSchema,
    outputSchema: GetTasksOutputSchema,
    // This flow doesn't need an LLM, it's for interacting with a service/database.
  },
  async (input) => {
    console.log("[getTasksFlow] Flow invoked with:", input);

    // --- Database Interaction Placeholder ---
    // In a real application:
    // 1. Connect to Firestore (or your chosen DB).
    // 2. Query the 'tasks' collection (potentially filter by userId, status, etc. based on input).
    // 3. Map the Firestore documents to the Task schema.
    // ----------------------------------------

    // Mocking database interaction:
    console.log("[getTasksFlow] MOCK IMPLEMENTATION: Reading tasks from mock in-memory database.");
    // Apply filters here if input included them (e.g., filter by completed status)
    const tasksToReturn = [...mockTaskDatabase]; // Return a copy

    console.log(`[getTasksFlow] Mock Read SUCCESS: Found ${tasksToReturn.length} tasks in memory.`);
    // console.log("[getTasksFlow] In-memory tasks:", JSON.stringify(tasksToReturn, null, 2)); // Uncomment for details

    const output: GetTasksOutput = {
      tasks: tasksToReturn,
    };

    console.log("[getTasksFlow] Flow successful. Returning output:", output);
    return output;
  }
);

// Functions internal to the module to manipulate the mock DB
// These are NOT exported as they are not async and violate 'use server'
function internalAddTask(newTask: Task) {
    mockTaskDatabase.push(newTask);
    console.log(`[internalAddTask] Mock DB Add. ID: ${newTask.id}. DB size: ${mockTaskDatabase.length}`);
}

function internalUpdateTask(taskId: string, updates: Partial<Task>): boolean {
     const taskIndex = mockTaskDatabase.findIndex(t => t.id === taskId);
     if (taskIndex > -1) {
         mockTaskDatabase[taskIndex] = { ...mockTaskDatabase[taskIndex], ...updates };
         console.log(`[internalUpdateTask] Mock DB Update. ID: ${taskId}. New state:`, mockTaskDatabase[taskIndex]);
         return true;
     }
     console.warn(`[internalUpdateTask] Mock DB Update FAILED. Task ID ${taskId} not found.`);
     return false;
}

// Expose access to the internal functions for other flows in this directory
export { internalAddTask, internalUpdateTask };

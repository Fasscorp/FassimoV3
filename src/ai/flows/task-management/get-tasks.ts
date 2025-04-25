
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
    console.warn("[getTasksFlow] MOCK IMPLEMENTATION: Attempting to read tasks from in-memory state.");
    let mockTasks: Task[] = [];
    try {
        // Dynamically import to access the state (NOT RECOMMENDED FOR PRODUCTION)
        const { conversationState } = await import('@/actions/handle-user-message');

        if (conversationState && Array.isArray(conversationState.tasks)) {
             mockTasks = conversationState.tasks.map(t => ({
                 id: t.id ?? `missing-id-${Math.random()}`, // Handle potential missing ID in mock state
                 description: t.description ?? 'No description',
                 priority: t.priority ?? 'medium',
                 dueDate: t.dueDate,
                 completed: t.completed ?? false,
             }));
             console.log(`[getTasksFlow] Mock Read SUCCESS: Found ${mockTasks.length} tasks in memory.`);
             // console.log("[getTasksFlow] In-memory tasks:", JSON.stringify(mockTasks, null, 2)); // Uncomment for details
        } else {
             console.warn("[getTasksFlow] Mock Read WARNING: Could not access in-memory tasks array or state is invalid.");
        }

    } catch (importError) {
         console.error("[getTasksFlow] Mock Read ERROR: Failed to import handle-user-message to access state:", importError);
    }


    const output: GetTasksOutput = {
      tasks: mockTasks,
    };

    console.log("[getTasksFlow] Flow successful. Returning output:", output);
    return output;
  }
);

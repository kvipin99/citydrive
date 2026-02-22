
'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating quiz questions using AI.
 *
 * - generateQuizQuestions - A function that generates multiple-choice questions for a given topic.
 * - GenerateQuizInput - The input type for the generateQuizQuestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizInputSchema = z.object({
  topic: z.string().describe('The subject or topic for the quiz (e.g., "Road Signs", "Defensive Driving").'),
  count: z.number().min(1).max(10).describe('The number of questions to generate.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const QuizQuestionSchema = z.object({
  question: z.string().describe('The quiz question.'),
  options: z.array(z.string()).length(4).describe('Four possible answers.'),
  correctAnswer: z.string().describe('The correct option (must match one of the options exactly).'),
});

const GenerateQuizOutputSchema = z.array(QuizQuestionSchema);
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;

export async function generateQuizQuestions(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return generateQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: { schema: GenerateQuizInputSchema },
  output: { schema: GenerateQuizOutputSchema },
  prompt: `You are an expert driving school instructor and examiner. 
  Generate {{count}} challenging multiple-choice questions about "{{topic}}" for a driving school student quiz.
  
  For each question:
  1. Provide exactly 4 options.
  2. Clearly identify the correct answer.
  3. Ensure the questions are accurate and relevant to driving safety and regulations.`,
});

const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate quiz questions.');
    }
    return output;
  }
);

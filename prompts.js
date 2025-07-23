// Prompt Templates for YouTube AI Article Generator
// These prompts can be customized to change AI behavior

const KEY_POINTS_PROMPT = `You can divide the transcript into smaller sections based on the themes being discussed. Extract all the points from these sections, with a good enough understanding of what is being discussed. Pay attention to the intention of the speaker when extracting the points and try to understand the insights, subtleties and nuances. Also pay attention to the delivery and the potential impact to understand the intention of the speaker, especially in terms of the analogies, examples and references to other concepts, events, and phenomena. Try not to explain; focus on presenting the facts with enough context. I would also like to let you know that I am actually interested in the content than the speakers. I would rather have facts and insights rather than what each speaker says and the flow of the conversation. I would appreciate it if you keep this in mind when you do this

Video Title: {VIDEO_TITLE}
Transcript:
{TRANSCRIPT}`;

const ARTICLE_GENERATION_PROMPT = `Write an easy to read article without losing the impactful insights from this. Focus on presenting facts with context than explaining. Try to incorporate all the relevant insights, nuances and subtleties. The language should be plain so that we can convey more facts and contexts with their subtleties, nuances and insights than opinions or inferences

Video Title: {VIDEO_TITLE}

Key Points to Base Article On:
{KEY_POINTS}

Transcript:
{TRANSCRIPT}

Please structure the article with:
# Title
## Introduction
## Main Content Sections (with appropriate headings)
## Conclusion`;

// Export for use in other files
window.KEY_POINTS_PROMPT = KEY_POINTS_PROMPT;
window.ARTICLE_GENERATION_PROMPT = ARTICLE_GENERATION_PROMPT;

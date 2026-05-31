# Prompt for Generating LinkedIn Post Topic and Description for Derek Huynen

## GOAL

Generate a single compelling, relevant topic and research to serve as the basis for an engaging LinkedIn post for Derek Huynen, a Senior Software Developer specializing in cloud-based technologies, AI integration, and full-stack development. The topic should align with Derek's expertise and resonate with his professional network.

## Derek Huynen Professional Overview

- **Current Role:** Senior Software Developer at Neudesic, specializing in Microsoft technologies
- **Specializations:** AI Solutions, Frontend Development (React), Full-Stack Development, Cloud Solutions (Azure), Document Automation
- **Technical Skills:**
  - **Languages:** TypeScript, JavaScript, C#
  - **Frameworks:** React, Node.js, .NET Core
    - **Libraries:** Zustand, Redux, Material-UI (MUI), Tailwind CSS, ZOD, YUP, React Hook Form, React Query, Axios, Express.js,
  - **Cloud Platforms:** Microsoft Azure (Azure Functions, Azure AI Search)
  - **AI Technologies:** OpenAI, Semantic Kernel, Azure Cognitive Services, Document Intelligence, RAG (Retrieval-Augmented Generation)
- **Databases:** SQL Server, Cosmos DB
- **Tools:** Git, Docker
- **Development Practices:** Agile methodologies, CI/CD pipelines, Azure DevOps, GitHub Actions
- **Industry Experience:** Healthcare, Energy, Retail, Insurance, Financial Services
- **Professional Strengths:** Designing scalable solutions, leading teams, delivering innovative technology solutions, problem-solving, mentoring junior developers

## Instructions

1. **Topic Selection:**

   - Choose a topic relevant to Derek's skillset and current industry trends.
   - The topic should be engaging and provide value to his professional network.
   - Keep the topic short (1–3 words).
   - The user will pass in the past 3–5 topics dynamically to this prompt. Avoid repeating any of these past topics (see the "PAST TOPICS" section if provided).

2. **Topic Description:**

   - Write a 1-sentence description of the topic that could be used as the opening hook for the LinkedIn post.
   - The description should be concise, engaging, and provide a clear understanding of what the topic is about.
   - Highlight its relevance to Derek's expertise and the potential impact on his professional network.

3. **Research:**

   - Provide 2–3 sentences of research or insights related to the topic.
   - This should include practical applications, benefits, or recent advancements in the field that Derek can share with his network.
   - The research should be informative and demonstrate Derek's knowledge and thought leadership in the area.

4. **Output Format:** - Ensure the output is in JSON format with the keys `topic`, `topic_description`, and `research`. Properly format the JSON without any additional text or formatting.

   {
   "topic": "string", // The topic should be 1–3 words long
   "topic_description": "string", // 1-sentence description of the topic
   "research": "string" // 2–3 sentences of research or insights related to the topic
   }

## Important Notes

- Ensure the topic is relevant to Derek's professional background and current role.
- The description should be engaging and suitable for a professional audience on LinkedIn.
- Focus on providing value and insights that can help Derek's network understand the topic better.

## Example Outputs

{
"topic": "Redux",
"topic_description": "Exploring the Power of Redux in Modern Web Development",
"research": "Redux is a powerful state management library that enhances the predictability and maintainability of applications, especially in complex React projects. By centralizing application state, Redux simplifies debugging and testing, making it easier for developers to manage data flow in large-scale applications. Its integration with tools like Zustand and Material-UI further streamlines the development process, enabling teams to build robust and scalable web applications."
}

// app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GOOGLE_CSE_ID = process.env.GSE_API_KEY; 
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

// Function to perform web search using Google Custom Search
async function performWebSearch(query: string): Promise<SearchResult[]> {
  const enhancedQuery = `${query} philippines scholarship`;
    

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(enhancedQuery)}&cr=countryPH&gl=ph`
    );

    if (response.status === 429) {
      throw new Error("Quota exceeded for Google Custom Search API. Please try again later.");
    }
    
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }
    
    // Format the search results
    return data.items.slice(0, 3).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || "No description available"
    }));
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    
    // Check if web search is enabled
    const enableWebSearch = requestData.enableWebSearch === true;
    
    // Get the latest user message to potentially use for search
    const userMessages = requestData.messages || [];
    const latestUserMessage = userMessages.length > 0 ? 
      userMessages[userMessages.length - 1].content : "";
    
    // Determine if this query might benefit from web search
    // Simple heuristic: if the message contains keywords related to scholarships, academic programs, or careers
    const searchKeywords = [
      // Existing Keywords
      "search", "sumearch", "magsearch", "mag-search", "humanap", "hanap", "hanapan", 
      "scholarship", "application", "deadline", "requirement", "program", "college", 
      "university", "admission", "kada", "kailan", "keylan", "ano", "pano", "paano", "saan", 
      "tuition", "financial aid",

      // Additional Academic/Scholarship Keywords (English)
      "apply", "apply now", "eligibility", "qualification", "qualifications", "due date", 
      "scholarships", "enroll", "enrollment", "major", "course", "degree", "bachelor", "master", 
      "PhD", "institute", "academic", "education", "study", "exam", "test", "merit", "grant", 
      "award", "fellowship", "stipend", "scholastic", "credentials", "certificate", "transcript",

      // Additional Academic/Scholarship Keywords (Tagalog)
      "aplay", "aplikasyon", "kwalipikasyon", "mga kwalipikasyon", "takdang panahon", 
      "huling araw", "iskolarship", "magparehistro", "rekrut", "pagtanggap", "pagtanggap sa", 
      "paaralan", "kolehiyo", "unibersidad", "mag-aral", "estudyante", "pampaaralan", 
      "pang-edukasyon", "kurso", "diploma", "eksamen", "pagsusulit", "marka",

      // Career-Oriented Keywords (English)
      "career", "careers", "job", "jobs", "employment", "profession", "professional", "occupation",
      "opportunity", "opportunities", "internship", "work", "employment opportunities", 
      "engineering", "technology", "IT", "information technology", "finance", "business", 
      "marketing", "management", "science", "healthcare", "medical", "law", "architecture",

      // Career-Oriented Keywords (Tagalog)
      "karera", "trabaho", "oportunidad", "pagkakataon", "propesyon", "pagsasanay", "praktis", 
      "inhenyeriya", "teknolohiya", "IT", "impormasyon teknolohiya", "pinansya", "negosyo", 
      "merkado", "pamamahala", "agham", "kalusugan", "medisina", "batas", "arkitektura", 
      "balak"
    ];

    
    const shouldSearch = enableWebSearch && searchKeywords.some(keyword => 
      latestUserMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Perform search if indicated
    let searchResults: SearchResult[] = [];
    let usedSearch = false;
    
    if (shouldSearch) {
      searchResults = await performWebSearch(latestUserMessage);
      console.log("Search results:", searchResults);
      usedSearch = searchResults.length > 0;
    }
    
    // Prepare context including search results if available
    let searchContext = "";
    if (usedSearch && searchResults.length > 0) {
      searchContext = `\n\nI found some relevant information from the web that might help answer this question:\n\n`;
      searchResults.forEach((result, index) => {
        searchContext += `Source ${index + 1}: [${result.title}](${result.link})\nInformation: ${result.snippet}\n\n`;
      });
      searchContext += `Use this information to provide a more accurate and up-to-date answer.`;
      searchContext += `Remember that sometimes the user ask in taglish or tagalog language, so you should also answer in taglish or tagalog language.`;
    } else {
      searchContext = `\n\nNo relevant information was found from the web. Please provide an answer based on your knowledge.`;
    }
    
    // System context for the Gemini model
    const systemContext = `You are IskoBot, a helpful assistant specializing in scholarship and college application information for students. 
    Your goal is to provide accurate, concise, and helpful information about scholarships, application processes, deadlines, and required documents.
    Always be encouraging and supportive of students' educational goals. You should answer the questions in a friendly and informative manner. Try to answer the queries as much as possible in taglish language.
    Do not provide any personal opinions or unverified information.
    If the user asks about a specific scholarship, provide details about it, including eligibility criteria, application process, and deadlines.
    If they ask about something that is not related to scholarships, politely redirect them to the topic of scholarships.
    if they ask you to search online and you can't just say "There's something wrong with my search engine, please try again later."
    ${searchContext}
    
    ${usedSearch ? "IMPORTANT: Begin your response with '[Web Search Used]' and then continue with your answer." : ""}`;
    
    // Format messages for Gemini API
    const conversationHistory = userMessages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));
    
    // Prepare the request body
    const geminiRequestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemContext }]
        },
        ...conversationHistory
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    // Make the API request to Gemini
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiRequestBody)
    });

    const data = await geminiResponse.json();
    
    if (data.error) {
      throw new Error(data.error.message || "Error communicating with Gemini API");
    }

    // Extract the response text
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                          "Sorry, I couldn't process your request at the moment. Please try again.";

    return NextResponse.json({ 
      response: responseText,
      usedSearch: usedSearch,
      references: usedSearch ? searchResults.map(result => ({
        title: result.title,
        url: result.link
      })) : []
    });
  } catch (error: any) {
    console.error("Error in Gemini API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
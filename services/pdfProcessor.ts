
import { VocabularyItem } from '../types';

// We need to declare the global pdfjsLib variable since we are loading it via script tag
declare const pdfjsLib: any;

export const parsePdf = async (file: File): Promise<VocabularyItem[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument(arrayBuffer);
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  const numPages = pdf.numPages;

  // Process pages in parallel
  const pagePromises = [];
  for (let i = 1; i <= numPages; i++) {
    pagePromises.push(pdf.getPage(i).then((page: any) => page.getTextContent()));
  }

  const pageContents = await Promise.all(pagePromises);

  // Reconstruct text from coordinates
  for (const content of pageContents) {
    const pageText = reconstructPageText(content);
    fullText += pageText + '\n';
  }

  return extractVocabulary(fullText);
};

// Helper: Reconstructs text based on X/Y coordinates to fix fragmentation
const reconstructPageText = (content: any): string => {
  const items = content.items;
  if (!items || items.length === 0) return '';

  const Y_TOLERANCE = 4; // Pixels difference to be considered same line
  const rows: { y: number, items: any[] }[] = [];

  for (const item of items) {
    // item.transform is [scaleX, skewY, skewX, scaleY, x, y]
    // We care about y (index 5) and x (index 4)
    const y = item.transform[5]; 
    
    // Find a row that is close enough in Y
    let row = rows.find(r => Math.abs(r.y - y) < Y_TOLERANCE);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  // Sort rows from Top to Bottom (Higher Y is higher on page)
  rows.sort((a, b) => b.y - a.y);

  let reconstructedPage = '';
  for (const row of rows) {
    // Sort items Left to Right
    row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    
    // Join items with a space to prevent "sociala.social" issues, 
    // but we can trim extra spaces later.
    const rowText = row.items.map((it: any) => it.str).join(' ');
    reconstructedPage += rowText + '\n';
  }

  return reconstructedPage;
};

const extractVocabulary = (text: string): VocabularyItem[] => {
  const vocab: VocabularyItem[] = [];
  const uniqueKeys = new Set<string>();
  
  // Words to ignore if they accidentally get parsed
  // Function scope to be accessible in both strict and fallback parsing loops.
  const stopWords = ['page', 'list', 'unit', 'story', 'section', 'part', 'vocabulary', 'word', 'audio', 'track'];

  // 1. SKIP STORY SECTION
  // Look for headers to start parsing from.
  const startMarkerRegex = /(?:List|Unit|Chapter)\s*\d+\s*[\u4e00-\u9fa5]+|Vocabulary|词汇表|Word\s*List/i;
  const match = text.match(startMarkerRegex);
  let processText = text;
  
  if (match && match.index) {
      console.log("Skipping story, found list start:", match[0]);
      processText = text.substring(match.index);
  }

  // 2. PARSING REGEX
  // Matches: [Word] ... [POS] [Chinese Definition]
  // Improvements:
  // - Handles multiple spaces
  // - Handles different POS formats (v., n., a., adj., etc.)
  // - Ensures Chinese is present
  // - Captures the rest of the line as definition
  
  const lineRegex = /^\s*(?:[\u2610\u2611\uF0A3\u25A1]|\s*\[[\sxX]?\])?\s*([a-zA-Z\-]{2,})\s+(.*(?:[a-z]{1,5}\.|[a-z]+\/[a-z]+\.)\s*.*[\u4e00-\u9fa5]+.*)$/gm;

  let lineMatch;
  let indexCounter = 0;
  while ((lineMatch = lineRegex.exec(processText)) !== null) {
    const rawWord = lineMatch[1].trim();
    let rawDef = lineMatch[2].trim();

    // Cleaning the definition
    // 1. Collapse multiple spaces to one
    rawDef = rawDef.replace(/\s+/g, ' ');
    // 2. Remove space between two Chinese characters (fixing fragmentation join issues)
    // Matches: (ChineseChar) space (ChineseChar) -> replace with $1$2
    rawDef = rawDef.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1');

    const lowerWord = rawWord.toLowerCase();
    if (stopWords.includes(lowerWord)) continue;
    
    // Duplication check
    if (!uniqueKeys.has(lowerWord)) {
      uniqueKeys.add(lowerWord);
      vocab.push({
        id: generateId(),
        word: rawWord,
        definition: rawDef,
        level: 0,
        originalIndex: indexCounter++
      });
    }
  }
  
  // Fallback: If line strict parsing failed (e.g. coordinates were messy), try loose stream parsing
  if (vocab.length < 5) {
      console.log("Strict parsing failed. Trying fallback stream parsing.");
      const streamRegex = /([a-zA-Z\-]{2,})\s+((?:[a-z]{1,5}\.|[a-z]+\/[a-z]+\.)\s*[\u4e00-\u9fa5\s\w\;\,\.\(\)\[\]]+)/g;
      
      let streamMatch;
      while ((streamMatch = streamRegex.exec(processText)) !== null) {
          const w = streamMatch[1].trim();
          let d = streamMatch[2].trim().replace(/\s+/g, ' ');
          d = d.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1');
          
          if (stopWords.includes(w.toLowerCase())) continue;
          if (!d.match(/[\u4e00-\u9fa5]/)) continue; 

          if (!uniqueKeys.has(w.toLowerCase())) {
              uniqueKeys.add(w.toLowerCase());
              vocab.push({
                  id: generateId(),
                  word: w,
                  definition: d,
                  level: 0,
                  originalIndex: indexCounter++
              });
          }
      }
  }

  return vocab;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

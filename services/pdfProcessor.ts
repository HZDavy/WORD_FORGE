
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
    
    // Join items intelligently to avoid splitting Chinese characters
    let rowText = '';
    for (let i = 0; i < row.items.length; i++) {
        const current = row.items[i];
        const next = row.items[i+1];
        
        rowText += current.str;
        
        if (next) {
            // Check gap between items
            // If current ends with Chinese and next starts with Chinese, join without space
            const isChinese = (str: string) => /[\u4e00-\u9fa5]/.test(str);
            const currentEndChinese = isChinese(current.str.slice(-1));
            const nextStartChinese = isChinese(next.str.charAt(0));
            
            // Calculate visual gap (approx)
            const gap = next.transform[4] - (current.transform[4] + current.width); // This width property might be missing in some PDF.js versions on raw items, but we rely on simple check first.
            
            // Heuristic: If both are Chinese, don't add space. 
            // If they are English, add space unless it's a hyphen break (not handling hyphen breaks for now).
            if (currentEndChinese && nextStartChinese) {
                // No space
            } else {
                // Add space for English or Mixed
                rowText += ' ';
            }
        }
    }
    reconstructedPage += rowText + '\n';
  }

  return reconstructedPage;
};

const extractVocabulary = (text: string): VocabularyItem[] => {
  const vocab: VocabularyItem[] = [];
  const uniqueKeys = new Set<string>();
  
  // Words to ignore if they accidentally get parsed
  const stopWords = ['page', 'list', 'unit', 'story', 'section', 'part', 'vocabulary', 'word', 'audio', 'track', 'story'];

  // 1. SKIP STORY SECTION (Optimized for Story 15)
  // Story 15 has "List 15" in the title on Page 1. The actual list is on Page 4.
  // We should look for the *LAST* occurrence of a List/Unit marker, or a specific "词汇表" marker.
  
  const markerRegex = /(?:List|Unit|Chapter)\s*\d+|Vocabulary|词汇表|Word\s*List/gi;
  const markers = [...text.matchAll(markerRegex)];
  
  let startIndex = 0;
  
  if (markers.length > 0) {
      // Priority 1: Look for explicit "词汇表" or "Vocabulary" headers
      const explicitHeader = markers.find(m => m[0].includes('词汇表') || m[0].toLowerCase().includes('vocabulary'));
      
      if (explicitHeader && explicitHeader.index !== undefined) {
          startIndex = explicitHeader.index;
      } else {
          // Priority 2: Use the LAST "List X" marker found.
          // This handles "Story 15 (List 15)" title appearing before the actual "List 15" header.
          const lastMarker = markers[markers.length - 1];
          if (lastMarker.index !== undefined) {
              startIndex = lastMarker.index;
          }
      }
      console.log(`Starting parse from index ${startIndex}`);
  }

  const processText = text.substring(startIndex);

  // 2. PARSING REGEX
  // Matches: [Start of Line] [Optional Checkbox] [Word] [Space] [POS] [Definition]
  // Story 15 Note: "overturn v./n. 打翻 推翻 颠倒" -> No brackets around POS, spaces between Chinese.
  // We use ^ anchor to avoid matching words inside sentences (e.g. "municipal (a. ...)")
  
  const lineRegex = /^\s*(?:[\u2610\u2611\uF0A3\u25A1]|\s*\[[\sxX]?\]|\s*[oO])?\s*([a-zA-Z\-]{2,})\s+((?:[a-z]+\.|[a-z]+\/[a-z]+\.)(?:[\s\w\;\,\.\(\)\[\]\/\~\>\<\-]*[\u4e00-\u9fa5]+.*))$/gm;

  let lineMatch;
  let indexCounter = 0;
  
  while ((lineMatch = lineRegex.exec(processText)) !== null) {
    const rawWord = lineMatch[1].trim();
    let rawDef = lineMatch[2].trim();

    const lowerWord = rawWord.toLowerCase();
    
    // Filter out common false positives or stop words
    if (stopWords.includes(lowerWord)) continue;
    if (lowerWord.length < 2) continue;

    // Normalize Definition
    const cleanDef = normalizeDefinition(rawDef);
    
    // Duplication check
    if (!uniqueKeys.has(lowerWord)) {
      uniqueKeys.add(lowerWord);
      vocab.push({
        id: generateId(),
        word: rawWord,
        definition: cleanDef,
        level: 0,
        originalIndex: indexCounter++
      });
    }
  }
  
  // Fallback: If strict parsing failed (fewer than 5 words), try a looser stream approach
  if (vocab.length < 5) {
      console.log("Strict parsing failed. Trying fallback stream parsing.");
      // Looser regex that doesn't require start-of-line
      const streamRegex = /([a-zA-Z\-]{2,})\s+((?:[a-z]{1,5}\.|[a-z]+\/[a-z]+\.)\s*[\u4e00-\u9fa5\s\w\;\,\.\(\)\[\]]+)/g;
      
      let streamMatch;
      while ((streamMatch = streamRegex.exec(processText)) !== null) {
          const w = streamMatch[1].trim();
          const dRaw = streamMatch[2].trim();
          
          if (stopWords.includes(w.toLowerCase())) continue;
          if (!dRaw.match(/[\u4e00-\u9fa5]/)) continue; // Must contain Chinese

          if (!uniqueKeys.has(w.toLowerCase())) {
              uniqueKeys.add(w.toLowerCase());
              vocab.push({
                  id: generateId(),
                  word: w,
                  definition: normalizeDefinition(dRaw),
                  level: 0,
                  originalIndex: indexCounter++
              });
          }
      }
  }

  return vocab;
};

// Helper: Normalize definition string
// 1. Collapse multiple spaces
// 2. Fix space-separated Chinese words (common in Story 15: "打翻 推翻" -> "打翻; 推翻")
// 3. Remove trailing numbers (page numbers)
const normalizeDefinition = (def: string): string => {
    let clean = def.replace(/\s+/g, ' ');
    
    // Replace space between two Chinese characters with a semicolon if they seem like separate words
    // Heuristic: If we have ChineseChar + Space + ChineseChar, it's likely a list.
    clean = clean.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1; $2');
    
    // Remove trailing numbers (like page numbers "15", "4") that often get attached to the last word on a page
    clean = clean.replace(/\s+\d+$/, '');

    return clean;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

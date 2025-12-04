

import { VocabularyItem } from '../types';

// We need to declare the global pdfjsLib variable since we are loading it via script tag
declare const pdfjsLib: any;
declare const mammoth: any;

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

export const parseTxt = async (file: File): Promise<VocabularyItem[]> => {
  const text = await file.text();
  return extractVocabulary(text);
};

export const parseDocx = async (file: File): Promise<VocabularyItem[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  return extractVocabulary(text);
};

// Helper: Reconstructs text based on X/Y coordinates with improved filtering
const reconstructPageText = (content: any): string => {
  let items = content.items;
  if (!items || items.length === 0) return '';

  // 1. FILTERING HEADERS / FOOTERS / NOISE
  const ys = items.map((i: any) => i.transform[5]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pageHeight = maxY - minY;
  const HEADER_FOOTER_THRESHOLD = pageHeight * 0.05; // Top/Bottom 5%

  items = items.filter((item: any) => {
    const str = item.str.trim();
    if (!str) return false;
    
    const y = item.transform[5];
    const isTop = y > maxY - HEADER_FOOTER_THRESHOLD;
    const isBottom = y < minY + HEADER_FOOTER_THRESHOLD;
    
    // Filter purely numeric items (Page numbers) or isolated single chars at edges
    // But preserve punctuation or brackets if they appear there
    if ((isTop || isBottom) && /^(\d+|Page\s*\d+|[a-z])$/i.test(str)) {
        return false;
    }
    return true;
  });

  // 2. GROUP BY ROWS
  const Y_TOLERANCE = 4; // Pixels difference to be considered same line
  const rows: { y: number, items: any[] }[] = [];

  for (const item of items) {
    const y = item.transform[5]; 
    let row = rows.find(r => Math.abs(r.y - y) < Y_TOLERANCE);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  // Sort rows from Top to Bottom
  rows.sort((a, b) => b.y - a.y);

  // 3. MERGE ROWS
  let reconstructedPage = '';
  for (const row of rows) {
    // Sort items Left to Right
    row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    
    let rowText = '';
    for (let i = 0; i < row.items.length; i++) {
        const current = row.items[i];
        const next = row.items[i+1];
        
        rowText += current.str;
        
        if (next) {
            // Font size estimate (scaleX)
            const fontSize = current.transform[0] || 10;
            // Width estimate if missing
            const currentWidth = current.width || (current.str.length * fontSize * 0.5);
            
            const endX = current.transform[4] + currentWidth;
            const startX = next.transform[4];
            const gap = startX - endX;

            // Use 0.2 * fontSize to ensure English words and Parts of Speech are separated.
            if (gap > fontSize * 0.2) {
                 rowText += ' ';
            }
        }
    }

    // Filter rows that are likely just floating page numbers or noise anywhere on the page
    if (/^\s*(\d+|page\s*\d+)\s*$/i.test(rowText)) {
        continue;
    }

    reconstructedPage += rowText + '\n';
  }

  return reconstructedPage;
};

const extractVocabulary = (text: string): VocabularyItem[] => {
  const vocab: VocabularyItem[] = [];
  const uniqueKeys = new Set<string>();
  
  // Words to ignore
  const stopWords = ['page', 'list', 'unit', 'story', 'section', 'part', 'vocabulary', 'word', 'audio', 'track', 'story', 'chapter'];

  // 1. SKIP STORY SECTION 
  const markerRegex = /(?:List|Unit|Chapter)\s*\d+|Vocabulary|词汇表|Word\s*List/gi;
  const markers = [...text.matchAll(markerRegex)];
  
  let startIndex = 0;
  if (markers.length > 0) {
      // Find the LAST "List/Vocabulary" marker to skip introductory story text if present.
      const explicitHeader = [...markers].reverse().find(m => 
          m[0].includes('词汇表') || 
          m[0].toLowerCase().includes('vocabulary') || 
          m[0].toLowerCase().includes('list')
      );
      
      if (explicitHeader && explicitHeader.index !== undefined) {
          startIndex = explicitHeader.index + explicitHeader[0].length; 
      }
  }

  const processText = text.substring(startIndex);

  // 2. PARSING REGEX
  // Matches lines starting with optional bullets, then a word (2+ letters), then a definition containing Chinese.
  const lineRegex = /^\s*(?:[\u2610\u2611\uF0A3\u25A1\u25CF#\-\*]|\s*\[[\sxX]?\]|\s*[oO]|\d+\.)?\s*([a-zA-Z\-]{2,})\s+((?:[a-z]{1,4}\.|[a-z]+\/[a-z]+\.)?.*[\u4e00-\u9fa5].*)$/gm;

  let lineMatch;
  let indexCounter = 0;
  
  while ((lineMatch = lineRegex.exec(processText)) !== null) {
    const rawWord = lineMatch[1].trim();
    let rawDef = lineMatch[2].trim();

    const lowerWord = rawWord.toLowerCase();
    
    if (stopWords.includes(lowerWord)) continue;
    if (lowerWord.length < 2 || /^\d+$/.test(lowerWord)) continue;

    const cleanDef = normalizeDefinition(rawDef);
    
    if (!uniqueKeys.has(lowerWord) && cleanDef.length > 0) {
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
  
  // Fallback: Stream parsing if strict mode fails (vocab length < 5)
  if (vocab.length < 5) {
      console.log("Strict parsing yielded few results. Trying fallback stream parsing.");
      const streamRegex = /([a-zA-Z\-]{2,})\s+((?:[a-z]{1,5}\.|[a-z]+\/[a-z]+\.)?\s*[^a-zA-Z\n]*[\u4e00-\u9fa5][^\n]*)/g;
      
      let streamMatch;
      while ((streamMatch = streamRegex.exec(processText)) !== null) {
          const w = streamMatch[1].trim();
          const dRaw = streamMatch[2].trim();
          
          if (stopWords.includes(w.toLowerCase())) continue;
          
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
const normalizeDefinition = (def: string): string => {
    // 1. Unicode Normalization (NFC preserves fullwidth punctuation like '（' and '，')
    let clean = def.normalize('NFC');

    // 2. Collapse multiple spaces to single space
    clean = clean.replace(/\s+/g, ' ');

    // Define Unicode Ranges for CJK and Fullwidth/CJK Punctuation
    // CJK Unified: 4e00-9fa5
    // Kangxi Radicals: 2f00-2fd5 (OCR sometimes outputs these)
    // CJK Radicals Supplement: 2e80-2eff
    // Fullwidth ASCII: ff00-ffef (includes （ ） ， etc.)
    // CJK Symbols/Punctuation: 3000-303f
    
    const cjkChars = '\\u4e00-\\u9fa5\\u2f00-\\u2fd5\\u2e80-\\u2eff';
    const symbolChars = '\\u3000-\\u303f\\uff00-\\uffef';
    
    const broadCjk = `[${cjkChars}${symbolChars}]`;

    // 3. Remove spaces between CJK/Symbol characters (fix PDF reconstruction gaps)
    // Example: "市 （ 立" -> "市（立"
    // We strictly only merge if BOTH sides are CJK or Fullwidth Symbol. 
    // We do NOT merge ASCII to CJK to avoid merging English words with Chinese definitions improperly.
    const spaceGapRegex = new RegExp(`(${broadCjk})\\s+(?=${broadCjk})`, 'g');
    clean = clean.replace(spaceGapRegex, '$1');

    // 4. Remove trailing isolated numbers (page numbers that might have attached to end of line)
    clean = clean.replace(/\s+\d+$/, '');

    return clean.trim();
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}
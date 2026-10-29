/**
 * Extrai texto completo de arquivos PDF preservando as linhas visuais,
 * filtrando a caixa vertical de assinatura à direita e demarcando as colunas
 * de Vencimentos ([V]) e Descontos ([D]) por coordenada X.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (progressText: string) => void
): Promise<{ text: string; pagesCount: number }> {
  onProgress?.('Carregando arquivo PDF...');

  const base64 = await fileToBase64(file);

  try {
    onProgress?.('Processando páginas da folha no servidor...');
    const res = await fetch('/api/extract-pdf-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64 })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.text) {
        return {
          text: data.text,
          pagesCount: data.pagesCount || 1
        };
      }
    }
    console.warn('API /api/extract-pdf-text não retornou sucesso, usando fallback local.');
  } catch (err) {
    console.warn('Falha na chamada /api/extract-pdf-text, tentando extração local no navegador:', err);
  }

  onProgress?.('Extraindo texto diretamente no navegador...');
  return await extractPdfTextInBrowser(file, onProgress);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function formatVisualLineWithColumns(lineItems: { str: string; x: number; y: number }[]): string {
  // Filtra textos verticais da margem direita de assinatura (x >= 515)
  const filtered = lineItems.filter(it => it.x < 515);
  if (filtered.length === 0) return '';

  filtered.sort((a, b) => a.x - b.x);
  const textLine = filtered.map(i => i.str.trim()).join(' ');

  // Se a linha parece ser um item de rubrica (começa com código numérico em x < 35 e termina com valor monetário em x >= 355)
  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  if (
    filtered.length >= 3 &&
    first.x < 35 &&
    /^\d{1,5}$/.test(first.str.trim()) &&
    last.x >= 355 &&
    /^\d[\d\.]*,\d{2}$/.test(last.str.trim())
  ) {
    const colTag = last.x >= 438 ? '[D]' : '[V]';
    return `${textLine} ${colTag}`;
  }

  return textLine;
}

async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ text: string; pagesCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Lendo página ${pageNum} de ${numPages}...`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items: { str: string; x: number; y: number }[] = [];
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      });
    }

    items.sort((a, b) => b.y - a.y);

    const lines: string[] = [];
    let currentLineItems: { str: string; x: number; y: number }[] = [];
    let currentLineY: number | null = null;

    for (const it of items) {
      if (currentLineY === null || Math.abs(currentLineY - it.y) <= 3.5) {
        currentLineItems.push(it);
        if (currentLineY === null) currentLineY = it.y;
      } else {
        const formatted = formatVisualLineWithColumns(currentLineItems);
        if (formatted) lines.push(formatted);
        currentLineItems = [it];
        currentLineY = it.y;
      }
    }
    if (currentLineItems.length > 0) {
      const formatted = formatVisualLineWithColumns(currentLineItems);
      if (formatted) lines.push(formatted);
    }

    pageTexts.push(`=== PAGE ${pageNum} ===\n` + lines.join('\n'));
  }

  return {
    text: pageTexts.join('\n\n'),
    pagesCount: numPages
  };
}

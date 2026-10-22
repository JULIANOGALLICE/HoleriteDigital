/**
 * Extrai texto completo de arquivos PDF preservando as linhas visuais
 * e delimitando páginas.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (progressText: string) => void
): Promise<{ text: string; pagesCount: number }> {
  onProgress?.('Carregando arquivo PDF...');

  // 1. Converter File em Base64 para envio à rota /api/extract-pdf-text
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

  // 2. Fallback: Leitura direta no navegador via pdfjs-dist
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

async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ text: string; pagesCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');

  // Configura worker
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

    // Coleta todos os itens de texto com coordenadas
    const items: { str: string; x: number; y: number }[] = [];
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      });
    }

    // Ordena decrescente em Y (do topo para a base da página)
    items.sort((a, b) => b.y - a.y);

    // Agrupa itens na mesma linha visual com tolerância de 3.5 pontos
    const lines: string[] = [];
    let currentLineItems: { str: string; x: number; y: number }[] = [];
    let currentLineY: number | null = null;

    for (const it of items) {
      if (currentLineY === null || Math.abs(currentLineY - it.y) <= 3.5) {
        currentLineItems.push(it);
        if (currentLineY === null) currentLineY = it.y;
      } else {
        currentLineItems.sort((a, b) => a.x - b.x);
        lines.push(currentLineItems.map(i => i.str).join(' '));
        currentLineItems = [it];
        currentLineY = it.y;
      }
    }
    if (currentLineItems.length > 0) {
      currentLineItems.sort((a, b) => a.x - b.x);
      lines.push(currentLineItems.map(i => i.str).join(' '));
    }

    pageTexts.push(`=== PAGE ${pageNum} ===\n` + lines.join('\n'));
  }

  return {
    text: pageTexts.join('\n\n'),
    pagesCount: numPages
  };
}

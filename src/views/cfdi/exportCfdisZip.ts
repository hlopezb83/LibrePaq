import { strToU8, zipSync } from 'fflate';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile } from '../../lib/formatters';
import { isGuestDemoMode } from '../../lib/sandbox/guest-demo-mode';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { chunkArray } from '../../shared/array-utils';
import type { CfdiDocument } from '../../shared/types';

/** Empaqueta y descarga en .zip los XMLs de los CFDIs seleccionados/visibles (pidiendo xml_raw si falta). */
export async function exportCfdisZip(
  cfdis: CfdiDocument[],
  rfcOrId: string,
  year: number,
  period: number,
  toast: { info: (msg: string) => void; success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  if (cfdis.length === 0) {
    toast.info('No hay comprobantes seleccionados para descargar en .ZIP.');
    return;
  }

  const resolvedXmls: Array<{ cfdi: CfdiDocument; xml: string }> = [];
  const missing = cfdis.filter((c) => !c.xmlRaw || c.xmlRaw.trim().length === 0);

  for (const c of cfdis) {
    if (c.xmlRaw && c.xmlRaw.trim().length > 0) {
      resolvedXmls.push({ cfdi: c, xml: c.xmlRaw });
    }
  }

  if (missing.length > 0) {
    if (isSupabaseConfigured && supabase && !isGuestDemoMode()) {
      const missingById = new Map(missing.map((c) => [c.id, c]));
      for (const idChunk of chunkArray(missing.map((c) => c.id), 100)) {
        try {
          const { data: rows } = await supabase
            .from('cfdi_documents')
            .select('id, xml_raw')
            .in('id', idChunk);
          for (const row of (rows || []) as Array<{ id: string; xml_raw?: string | null }>) {
            const cfdi = missingById.get(String(row.id));
            if (cfdi && row.xml_raw && row.xml_raw.trim().length > 0) {
              resolvedXmls.push({ cfdi, xml: row.xml_raw });
            }
          }
        } catch {
          // Omitir bloque con error; se reportará en el conteo de XMLs faltantes
        }
      }
    } else {
      for (const batch of chunkArray(missing, 8)) {
        const fetched = await Promise.all(
          batch.map(async (cfdi) => {
            try {
              const xml = await apiClient.getCfdiXml(cfdi.id);
              return xml && xml.trim().length > 0 ? { cfdi, xml } : null;
            } catch {
              return null;
            }
          })
        );
        for (const item of fetched) {
          if (item) resolvedXmls.push(item);
        }
      }
    }
  }

  if (resolvedXmls.length === 0) {
    toast.error('Ninguno de los comprobantes seleccionados cuenta con XML disponible en la bóveda.');
    return;
  }

  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  for (const { cfdi, xml } of resolvedXmls) {
    const base = `CFDI_${(cfdi.serie || 'S').replace(/[^A-Za-z0-9_-]/g, '')}_${(cfdi.folio || '0').replace(/[^A-Za-z0-9_-]/g, '')}_${cfdi.uuid.slice(0, 8)}`;
    let name = `${base}.xml`;
    let idx = 2;
    while (usedNames.has(name)) {
      name = `${base}_${idx}.xml`;
      idx += 1;
    }
    usedNames.add(name);
    files[name] = strToU8(xml);
  }

  const zipped = zipSync(files, { level: 6 });
  const zipBuffer = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength
  ) as ArrayBuffer;
  const zipName = `XML_ADD_${rfcOrId}_${year}_P${String(period).padStart(2, '0')}.zip`;
  downloadBlobFile(zipName, zipBuffer, 'application/zip');
  const omittedCount = cfdis.length - resolvedXmls.length;
  toast.success(
    omittedCount > 0
      ? `Descargado paquete .ZIP con ${resolvedXmls.length} XML(s) (${omittedCount} comprobante(s) sin XML en bóveda).`
      : `Descargado paquete .ZIP con ${resolvedXmls.length} XML(s).`
  );
}

import { ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? (result.split(',')[1] ?? '') : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function triggerDownloadBase64File(filename: string, base64Content: string) {
  const binary = atob(base64Content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const SAT_TIPO_SOLICITUD_OPTS = [
  {
    id: 'RECIBIDOS',
    label: 'Facturas de Gastos',
    desc: 'Emitidas por proveedores a tu empresa (Recibidas)',
    icon: ArrowDownLeft,
    activeBorder: 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/80',
    iconColor: 'text-blue-600',
    dotColor: 'bg-blue-600'
  },
  {
    id: 'EMITIDOS',
    label: 'Facturas de Ingresos',
    desc: 'Emitidas por tu empresa a clientes y nóminas',
    icon: ArrowUpRight,
    activeBorder: 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/80',
    iconColor: 'text-emerald-600',
    dotColor: 'bg-blue-600'
  },
  {
    id: 'AMBOS',
    label: 'Ambas (Gastos e Ingresos)',
    desc: 'Sincroniza compras y ventas en una sola consulta',
    icon: Sparkles,
    activeBorder: 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/90',
    iconColor: 'text-indigo-600',
    dotColor: 'bg-indigo-600'
  }
] as const;

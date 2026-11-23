import { SAFETY_BOUNDS } from './sat-constants';
import { decodeXmlEntities } from './xml-utils';

export type XmlNode = Record<string, unknown>;
const MAX_XML_TREE_DEPTH = 24;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function round2(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

export function getAttr(node: unknown, attrName: string): string {
  if (!node || typeof node !== 'object') return '';
  const rec = node as XmlNode;
  const attrKey = `@_${attrName}`;
  if (!Object.hasOwn(rec, attrKey)) return '';
  const val = rec[attrKey];
  return typeof val === 'string' || typeof val === 'number'
    ? decodeXmlEntities(String(val).trim())
    : '';
}

export function findNode(node: unknown, targetTag: string, depth = 0): XmlNode | null {
  if (!node || typeof node !== 'object' || depth > MAX_XML_TREE_DEPTH) return null;
  const rec = node as XmlNode;
  if (!UNSAFE_KEYS.has(targetTag) && Object.hasOwn(rec, targetTag) && rec[targetTag]) {
    const val = rec[targetTag];
    return Array.isArray(val) ? ((val[0] as XmlNode) ?? null) : (val as XmlNode);
  }
  for (const k of Object.keys(rec)) {
    if (UNSAFE_KEYS.has(k) || k.startsWith('@_')) continue;
    const child = rec[k];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findNode(item, targetTag, depth + 1);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findNode(child, targetTag, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function findNodes(node: unknown, targetTag: string): XmlNode[] {
  const results: XmlNode[] = [];
  function recurse(curr: unknown, depth: number) {
    if (!curr || typeof curr !== 'object' || depth > MAX_XML_TREE_DEPTH) return;
    if (results.length >= SAFETY_BOUNDS.MAX_XML_TAGS) return;
    const rec = curr as XmlNode;
    for (const k of Object.keys(rec)) {
      if (UNSAFE_KEYS.has(k)) continue;
      const v = rec[k];
      if (k === targetTag) {
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item && typeof item === 'object') results.push(item as XmlNode);
          }
        } else if (v && typeof v === 'object') {
          results.push(v as XmlNode);
        }
      } else if (!k.startsWith('@_') && v && typeof v === 'object') {
        if (Array.isArray(v)) {
          for (const item of v) recurse(item, depth + 1);
        } else {
          recurse(v, depth + 1);
        }
      }
    }
  }
  recurse(node, 0);
  return results;
}

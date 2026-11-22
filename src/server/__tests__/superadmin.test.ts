import { describe, expect, test } from 'bun:test';
import {
  getAdminMetricsRepo,
  getAdminCompaniesRepo,
  getAdminUsersRepo
} from '../repositories/admin.repo';
import { checkIsSuperAdmin } from '../../context/AuthContext';
import type { User } from '@supabase/supabase-js';

describe('SuperAdmin Platform Governance Suite', () => {
  test('1. getAdminMetricsRepo retorna métricas globales del sistema', () => {
    const metrics = getAdminMetricsRepo();
    expect(metrics).toBeDefined();
    expect(metrics.totalUsers).toBeGreaterThanOrEqual(1);
    expect(metrics.supabaseConnected).toBe(true);
    expect(metrics.googleAdsActive).toBe(true);
    expect(metrics.satSoapOnline).toBe(true);
  });

  test('2. getAdminCompaniesRepo retorna la lista global de empresas fiscales y su tipo de propietario', () => {
    const companies = getAdminCompaniesRepo();
    expect(companies).toBeArray();
    expect(companies.length).toBeGreaterThan(0);
    expect(companies[0]!).toHaveProperty('rfc');
    expect(companies[0]!).toHaveProperty('name');
    expect(['user', 'superadmin', 'demo']).toContain(companies[0]!.ownerType || 'demo');
  });

  test('3. getAdminUsersRepo retorna al dueño oficial hlopezb@gmail.com con rol SuperAdmin', () => {
    const users = getAdminUsersRepo();
    expect(users).toBeArray();
    const owner = users.find((u) => u.email === 'hlopezb@gmail.com');
    expect(owner).toBeDefined();
    expect(owner?.isSuperAdmin).toBe(true);
    expect(owner?.status).toBe('ACTIVO');
  });

  test('4. checkIsSuperAdmin aprueba estrictamente a hlopezb@gmail.com y bloquea intrusos', () => {
    const mockSuperUser = {
      id: 'usr_owner',
      email: 'hlopezb@gmail.com',
      app_metadata: { role: 'superadmin' }
    } as unknown as User;

    const mockRegularUser = {
      id: 'usr_normal',
      email: 'contador.comun@despacho.mx',
      app_metadata: { role: 'authenticated' }
    } as unknown as User;

    expect(checkIsSuperAdmin(mockSuperUser)).toBe(true);
    expect(checkIsSuperAdmin(mockRegularUser)).toBe(false);
    expect(checkIsSuperAdmin(null)).toBe(false);
  });
});

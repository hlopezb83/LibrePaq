import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { api } from '../api';
import { initDatabase } from '../schema';
import {
  createCompanyRecord,
  deleteCompanyRecord,
  getCompanies,
  getCompanyById,
  updateCompanyRecord
} from '../repositories/companies.repo';
import type { Company } from '../../shared/types';

describe('Multi-Tenant Permissions & New User Isolation Suite', () => {
  const userAlphaId = 'usr_tenant_alpha_111';
  const userBetaId = 'usr_tenant_beta_222';
  const userGammaId = 'usr_tenant_gamma_333';

  let companyAlpha1Id = '';
  let companyAlpha2Id = '';
  let companyBeta1Id = '';
  let companyGamma1Id = '';

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    // Limpieza de empresas creadas durante las pruebas de aislamiento
    const cleanupIds = [companyAlpha1Id, companyAlpha2Id, companyBeta1Id, companyGamma1Id];
    for (const id of cleanupIds) {
      if (id) deleteCompanyRecord(id);
    }
  });

  test('1. Nuevo usuario Alpha entra por primera vez y recibe únicamente su propia empresa limpia', () => {
    const alphaCompanies = getCompanies(
      userAlphaId,
      'alpha@contadores-asociados.mx',
      'Despacho Alpha'
    );

    expect(alphaCompanies).toBeArray();
    expect(alphaCompanies.length).toBe(1);

    const initialCompany = alphaCompanies[0]!;
    expect(initialCompany).toBeDefined();
    companyAlpha1Id = initialCompany.id;

    // La empresa creada debe pertenecer estrictamente a userAlphaId
    expect(initialCompany.userId).toBe(userAlphaId);
    expect(initialCompany.name).toContain('Despacho Alpha');
    expect(initialCompany.rfc).toBe('XAXX010101000');
  });

  test('2. Aislamiento estricto: Alpha NO ve ninguna de las empresas demo globales ni de otros usuarios', () => {
    const alphaCompanies = getCompanies(userAlphaId);
    expect(alphaCompanies.length).toBe(1);

    // No debe contener empresas demo del sistema (ej. Tecnologías Nube del Norte o Comercializadora Bajío)
    const demoCompanyIds = ['comp_tnn_01', 'comp_cib_02', 'comp_tlb_03'];
    for (const demoId of demoCompanyIds) {
      expect(alphaCompanies.some((c) => c.id === demoId)).toBe(false);
    }

    // Todas las empresas retornadas deben tener userId igual a userAlphaId
    for (const comp of alphaCompanies) {
      expect(comp.userId).toBe(userAlphaId);
    }
  });

  test('3. Segundo nuevo usuario Beta entra y recibe su propia empresa independiente', () => {
    const betaCompanies = getCompanies(
      userBetaId,
      'beta@corporativo-norte.mx',
      'Corporativo Beta'
    );

    expect(betaCompanies.length).toBe(1);
    const betaComp = betaCompanies[0]!;
    companyBeta1Id = betaComp.id;

    expect(betaComp.userId).toBe(userBetaId);
    expect(betaComp.name).toContain('Corporativo Beta');
    expect(betaComp.id).not.toBe(companyAlpha1Id);
  });

  test('4. Cero contaminación cruzada entre tenants (Alpha no ve a Beta, Beta no ve a Alpha)', () => {
    const alphaList = getCompanies(userAlphaId);
    const betaList = getCompanies(userBetaId);

    // Alpha no contiene la empresa de Beta
    expect(alphaList.some((c) => c.id === companyBeta1Id)).toBe(false);
    expect(alphaList.some((c) => c.userId === userBetaId)).toBe(false);

    // Beta no contiene la empresa de Alpha
    expect(betaList.some((c) => c.id === companyAlpha1Id)).toBe(false);
    expect(betaList.some((c) => c.userId === userAlphaId)).toBe(false);
  });

  test('5. Creación de empresas adicionales por un usuario se afilia a su propio tenant', () => {
    const createdAlpha2 = createCompanyRecord({
      name: 'Alpha Consultoría Financiera SC',
      rfc: 'ACF2201019K9',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: userAlphaId
    });
    companyAlpha2Id = createdAlpha2.id;

    // Alpha ahora tiene 2 empresas en su workspace
    const alphaList = getCompanies(userAlphaId);
    expect(alphaList.length).toBe(2);
    expect(alphaList.some((c) => c.id === companyAlpha2Id)).toBe(true);

    // Beta sigue teniendo estrictamente 1 empresa y no ve la nueva empresa de Alpha
    const betaList = getCompanies(userBetaId);
    expect(betaList.length).toBe(1);
    expect(betaList.some((c) => c.id === companyAlpha2Id)).toBe(false);
  });

  test('6. Protección de lectura por ID: getCompanyById deniega acceso a IDs de otros usuarios', () => {
    // Alpha consulta su propia empresa: éxito
    const ownComp = getCompanyById(companyAlpha1Id, userAlphaId);
    expect(ownComp).not.toBeNull();
    expect(ownComp?.id).toBe(companyAlpha1Id);

    // Beta intenta consultar la empresa de Alpha con su propio userId: denegado (retorna null)
    const unauthorizedComp = getCompanyById(companyAlpha1Id, userBetaId);
    expect(unauthorizedComp).toBeNull();
  });

  test('7. Protección contra modificaciones no autorizadas: updateCompanyRecord', () => {
    // Beta intenta renombrar la empresa de Alpha
    const intruderUpdate = updateCompanyRecord(
      companyAlpha1Id,
      {
        name: 'HACKED BY BETA',
        rfc: 'HAK010101000',
        regimenFiscal: '601',
        codigoPostal: '99999'
      },
      userBetaId
    );

    // Debe denegar la actualización
    expect(intruderUpdate).toBeNull();

    // La empresa de Alpha debe permanecer intacta
    const verifyComp = getCompanyById(companyAlpha1Id, userAlphaId);
    expect(verifyComp?.name).not.toBe('HACKED BY BETA');
    expect(verifyComp?.codigoPostal).toBe('06000');

    // Alpha renombra su propia empresa: éxito
    const legitimateUpdate = updateCompanyRecord(
      companyAlpha1Id,
      {
        name: 'Despacho Alpha Oficial SC',
        rfc: 'XAXX010101000',
        regimenFiscal: '601',
        codigoPostal: '06000'
      },
      userAlphaId
    );
    expect(legitimateUpdate?.name).toBe('Despacho Alpha Oficial SC');
  });

  test('8. Protección contra eliminaciones no autorizadas: deleteCompanyRecord', () => {
    // Beta intenta borrar una empresa de Alpha
    const deletedIntruder = deleteCompanyRecord(companyAlpha2Id, userBetaId);
    expect(deletedIntruder).toBe(false);

    // La empresa de Alpha debe seguir existiendo intacta
    const exists = getCompanyById(companyAlpha2Id, userAlphaId);
    expect(exists).not.toBeNull();

    // Alpha puede borrar su segunda empresa legítimamente
    const deletedAlpha = deleteCompanyRecord(companyAlpha2Id, userAlphaId);
    expect(deletedAlpha).toBe(true);

    const existsAfterDelete = getCompanyById(companyAlpha2Id, userAlphaId);
    expect(existsAfterDelete).toBeNull();
  });

  test('9. Usuario no autenticado / visitante demo solo ve empresas públicas y nunca privadas', () => {
    const demoCompanies = getCompanies(); // Sin userId
    expect(demoCompanies.length).toBeGreaterThan(0);

    // Ninguna empresa privada de Alpha o Beta debe ser visible para visitantes demo
    expect(demoCompanies.some((c) => c.id === companyAlpha1Id)).toBe(false);
    expect(demoCompanies.some((c) => c.id === companyBeta1Id)).toBe(false);
    expect(demoCompanies.some((c) => c.userId === userAlphaId)).toBe(false);
    expect(demoCompanies.some((c) => c.userId === userBetaId)).toBe(false);
  });

  test('10. End-to-End REST API: Aislamiento HTTP completo mediante headers X-User-Id', async () => {
    // 10.1 Nuevo usuario Gamma solicita GET /api/companies por primera vez
    const resGammaInit = await api.request('/api/companies', {
      headers: {
        'X-User-Id': userGammaId,
        'X-User-Email': 'gamma@despacho-fiscal.com',
        'X-User-Name': 'Gamma Fiscal'
      }
    });
    expect(resGammaInit.status).toBe(200);
    const gammaList = (await resGammaInit.json()) as Company[];
    expect(gammaList.length).toBe(1);
    const gammaComp = gammaList[0]!;
    expect(gammaComp.userId).toBe(userGammaId);
    companyGamma1Id = gammaComp.id;

    // 10.2 Intruso (Beta) intenta hacer GET /api/companies/:id a la empresa de Gamma
    const resIntruderGet = await api.request(`/api/companies/${companyGamma1Id}`, {
      headers: { 'X-User-Id': userBetaId }
    });
    expect(resIntruderGet.status).toBe(404);

    // 10.3 Intruso (Beta) intenta hacer PUT /api/companies/:id a la empresa de Gamma
    const resIntruderPut = await api.request(`/api/companies/${companyGamma1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userBetaId
      },
      body: JSON.stringify({
        name: 'ATTEMPTED HIJACK',
        rfc: 'XAXX010101000',
        regimenFiscal: '601',
        codigoPostal: '06000'
      })
    });
    expect(resIntruderPut.status).toBe(404);

    // 10.4 Intruso (Beta) intenta hacer DELETE /api/companies/:id a la empresa de Gamma
    const resIntruderDel = await api.request(`/api/companies/${companyGamma1Id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userBetaId }
    });
    expect(resIntruderDel.status).toBe(404);

    // 10.5 Gamma hace GET /api/companies/:id a su propia empresa: 200 OK
    const resOwnerGet = await api.request(`/api/companies/${companyGamma1Id}`, {
      headers: { 'X-User-Id': userGammaId }
    });
    expect(resOwnerGet.status).toBe(200);
    const ownData = (await resOwnerGet.json()) as Company;
    expect(ownData.id).toBe(companyGamma1Id);
    expect(ownData.userId).toBe(userGammaId);
  });
});

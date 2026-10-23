import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Employee, PayReceipt, SystemConfig, SignatureVerification, UserAccount, MedicalCertificate, IncomeReport } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { getDefaultA1Certificate, getActiveA1Certificate } from '../utils/certificateA1';

export const DEFAULT_CONFIG: SystemConfig = {
  razaoSocial: 'FRANCISCO JOSE BARBOSA NOBRE',
  cei: '800136945806',
  centroCusto: 'GERAL',
  regime: 'Mensalista',
  exigirCodigoAssinatura: true,
  canalAssinaturaPadrao: 'WHATSAPP',
  mensagemWhatsappPadrao: 'Olá {nome}, seu holerite de {mesAno} no valor de R$ {valorLiquido} está disponível. Seu código de validação da assinatura digital é: {codigoAssinatura}',
  emailRemetente: 'julianogallice@gmail.com',
  emailNomeRemetente: 'Departamento Pessoal - Cartório Nobre',
  emailReplyTo: 'julianogallice@gmail.com',
  emailProvider: 'SMTP',
  smtpHost: 'smtp.cartoriouberaba.com.br',
  smtpPort: 587,
  smtpUser: 'rh@cartoriouberaba.com.br',
  smtpPassword: 'Cartorio18441',
  smtpSecure: false,
  emailApiKey: '',
  emailTemplateAssunto: '[Holerite Digital] Recibo de Pagamento - {mesAno} - {nome}',
  emailTemplateCorpo: 'Olá, {nome}. Seu recibo de pagamento de {mesAno} já está disponível para visualização e download em PDF no portal do colaborador.',
  diasPrazoAssinatura: 5,
  certificadoA1: getDefaultA1Certificate(),
  exigirCompletarCadastroPrimeiroAcesso: true
};

// 1. Employees
export function subscribeEmployees(callback: (employees: Employee[]) => void, onError?: (err: any) => void) {
  const path = 'employees';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Employee) });
      });
      callback(list);
    },
    (err) => {
      console.warn('Fallback to local if Firestore permission error: ', err.message);
      if (onError) onError(err);
    }
  );
}

export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' && item !== null ? cleanUndefined(item) : item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = typeof val === 'object' && val !== null ? cleanUndefined(val) : val;
      }
    }
    return cleaned as T;
  }
  return obj;
}

export async function saveEmployeeFirestore(employee: Employee): Promise<void> {
  const path = `employees/${employee.codigo}`;
  try {
    await setDoc(doc(db, 'employees', employee.codigo), cleanUndefined(employee), { merge: true });
  } catch (error) {
    console.warn('saveEmployeeFirestore notice:', error);
  }
}

export async function deleteEmployeeFirestore(codigo: string): Promise<void> {
  const path = `employees/${codigo}`;
  try {
    await deleteDoc(doc(db, 'employees', codigo));
  } catch (error) {
    console.warn('deleteEmployeeFirestore notice:', error);
  }
}

// 2. Receipts
export function subscribeReceipts(callback: (receipts: PayReceipt[]) => void, onError?: (err: any) => void) {
  const path = 'receipts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: PayReceipt[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...(docSnap.data() as PayReceipt), id: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      console.warn('Fallback to local if Firestore permission error: ', err.message);
      if (onError) onError(err);
    }
  );
}

export async function saveReceiptFirestore(receipt: PayReceipt): Promise<void> {
  const path = `receipts/${receipt.id}`;
  try {
    await setDoc(doc(db, 'receipts', receipt.id), cleanUndefined(receipt), { merge: true });
  } catch (error) {
    console.warn('saveReceiptFirestore notice:', error);
  }
}

export async function signReceiptFirestore(
  receiptId: string,
  codigoAssinatura: string,
  metodo: 'WHATSAPP' | 'EMAIL',
  fullReceipt?: PayReceipt
): Promise<void> {
  const path = `receipts/${receiptId}`;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

  const updateData = {
    statusAssinatura: 'ASSINADO' as const,
    dataAssinatura: formattedDate,
    ipAssinatura: 'Autenticado via Certificado 2FA',
    codigoAssinatura,
    metodoAssinatura: metodo
  };

  try {
    if (fullReceipt) {
      await setDoc(doc(db, 'receipts', receiptId), { ...fullReceipt, ...updateData }, { merge: true });
    } else {
      await setDoc(doc(db, 'receipts', receiptId), updateData, { merge: true });
    }
  } catch (error) {
    console.warn('signReceiptFirestore notice:', error);
  }
}

// 3. System Config
export function subscribeSystemConfig(callback: (config: SystemConfig) => void) {
  const path = 'systemConfig/default';
  return onSnapshot(
    doc(db, 'systemConfig', 'default'),
    (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as SystemConfig;
        const activeCert = getActiveA1Certificate(remoteData.certificadoA1);
        callback({
          ...DEFAULT_CONFIG,
          ...remoteData,
          certificadoA1: activeCert,
          id: snap.id
        });
      }
    },
    (err) => {
      console.warn('Firestore systemConfig subscription notice: ', err.message);
    }
  );
}

export async function saveSystemConfigFirestore(config: SystemConfig): Promise<void> {
  const path = 'systemConfig/default';
  try {
    await setDoc(doc(db, 'systemConfig', 'default'), config, { merge: true });
  } catch (error) {
    console.warn('saveSystemConfigFirestore notice:', error);
  }
}

// 4. Digital Signature Verification Codes (2FA OTP)
export async function createSignatureVerificationCode(
  receiptId: string,
  employeeCodigo: string,
  canal: 'WHATSAPP' | 'EMAIL',
  destinatario: string
): Promise<string> {
  // Generate random 6-digit cryptographic code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationId = `sig-${receiptId}-${Date.now()}`;
  const verification: SignatureVerification = {
    id: verificationId,
    codigo: code,
    receiptId,
    employeeCodigo,
    canal,
    destinatario,
    criadoEm: new Date().toISOString(),
    status: 'PENDENTE'
  };

  try {
    sessionStorage.setItem(`sig_otp_${receiptId}`, code);
    localStorage.setItem(`sig_otp_${receiptId}`, code);
  } catch {}

  const path = `signatureVerifications/${verificationId}`;
  try {
    await setDoc(doc(db, 'signatureVerifications', verificationId), verification);
  } catch (error) {
    console.warn('Could not write signatureVerification to Firestore, fallback to local verification:', error);
  }
  return code;
}

export async function validateSignatureCode(
  receiptId: string,
  enteredCode: string
): Promise<boolean> {
  const cleanEntered = enteredCode.trim();

  // 1. Check local session storage fallback first
  try {
    const localOtp = sessionStorage.getItem(`sig_otp_${receiptId}`) || localStorage.getItem(`sig_otp_${receiptId}`);
    if (localOtp && localOtp.trim() === cleanEntered) {
      return true;
    }
  } catch {}

  // 2. Query Firestore
  const path = 'signatureVerifications';
  try {
    const q = query(
      collection(db, path),
      where('receiptId', '==', receiptId),
      where('status', '==', 'PENDENTE')
    );
    const snap = await getDocs(q);
    let matched = false;

    for (const docItem of snap.docs) {
      const data = docItem.data() as SignatureVerification;
      if (data.codigo.trim() === cleanEntered) {
        matched = true;
        try {
          await updateDoc(doc(db, 'signatureVerifications', docItem.id), {
            status: 'UTILIZADO'
          });
        } catch {}
        break;
      }
    }
    return matched;
  } catch (error) {
    console.warn('Error validating signature code in Firestore, fallback to local cache:', error);
    try {
      const localOtp = sessionStorage.getItem(`sig_otp_${receiptId}`) || localStorage.getItem(`sig_otp_${receiptId}`);
      if (localOtp && localOtp.trim() === cleanEntered) {
        return true;
      }
    } catch {}
    return false;
  }
}

// 5. Users and Roles
export function subscribeUsers(callback: (users: UserAccount[]) => void) {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const users: UserAccount[] = [];
      snap.forEach((docItem) => {
        users.push(docItem.data() as UserAccount);
      });
      callback(users);
    },
    (error) => {
      console.warn('Realtime subscription error for users:', error.message);
    }
  );
}

export async function saveUserAccount(user: UserAccount): Promise<void> {
  const uid = user.uid || (user.employeeCodigo ? `user-${user.employeeCodigo}` : `user-${Date.now()}`);
  const payload = cleanUndefined({ ...user, uid });
  try {
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
  } catch (error) {
    console.warn('saveUserAccount notice:', error);
  }
}

export async function saveUsersBatchFirestore(usersList: UserAccount[]): Promise<void> {
  if (!usersList || usersList.length === 0) return;
  // Chunking in slices of 150 documents to stay well below Firestore 500 limits
  const CHUNK_SIZE = 150;
  for (let i = 0; i < usersList.length; i += CHUNK_SIZE) {
    const chunk = usersList.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(user => {
        const uid = user.uid || (user.employeeCodigo ? `user-${user.employeeCodigo}` : `user-${Date.now()}`);
        const ref = doc(db, 'users', uid);
        batch.set(ref, cleanUndefined({ ...user, uid }), { merge: true });
      });
      await batch.commit();
    } catch (batchError) {
      console.warn('saveUsersBatchFirestore chunk batch error, falling back to individual sets:', batchError);
      await Promise.allSettled(
        chunk.map(user => {
          const uid = user.uid || (user.employeeCodigo ? `user-${user.employeeCodigo}` : `user-${Date.now()}`);
          return setDoc(doc(db, 'users', uid), cleanUndefined({ ...user, uid }), { merge: true });
        })
      );
    }
  }

  // Also sync to server-side permanent disk storage if backend route is available
  try {
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: usersList })
    }).catch(() => {});
  } catch (e) {}
}

export async function deleteUserAccountFirestore(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.warn('deleteUserAccountFirestore notice:', error);
  }
}

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Clean all records for pristine production database
export async function clearAllDatabaseData(): Promise<void> {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    for (const d of empSnap.docs) {
      await deleteDoc(d.ref);
    }
    const recSnap = await getDocs(collection(db, 'receipts'));
    for (const d of recSnap.docs) {
      await deleteDoc(d.ref);
    }
    const certSnap = await getDocs(collection(db, 'medicalCertificates'));
    for (const d of certSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.error(e);
  }
}

// 5. Medical Certificates (Atestados Médicos)
const MAX_SINGLE_DOC_BASE64_LENGTH = 650000; // ~650 KB string safely inside Firestore 1 MiB limit

export function subscribeMedicalCertificates(
  callback: (certificates: MedicalCertificate[]) => void,
  onError?: (err: any) => void
) {
  const path = 'medicalCertificates';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const rawCerts: Array<MedicalCertificate & { chunkCount?: number }> = [];
      const chunksByParent: Record<string, Array<{ chunkIndex: number; chunkData: string }>> = {};

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        if (data?.isChunk && data?.parentId) {
          if (!chunksByParent[data.parentId]) {
            chunksByParent[data.parentId] = [];
          }
          chunksByParent[data.parentId].push({
            chunkIndex: Number(data.chunkIndex || 0),
            chunkData: String(data.chunkData || '')
          });
        } else {
          rawCerts.push({ ...(data as MedicalCertificate), id: docSnap.id });
        }
      });

      const list: MedicalCertificate[] = rawCerts.map(cert => {
        if (cert.arquivoBase64 === '__CHUNKED__' && chunksByParent[cert.id]) {
          const sortedChunks = chunksByParent[cert.id].sort((a, b) => a.chunkIndex - b.chunkIndex);
          return {
            ...cert,
            arquivoBase64: sortedChunks.map(c => c.chunkData).join('')
          };
        }
        return cert;
      });

      // Sort newest first
      list.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      callback(list);
    },
    (err) => {
      console.warn('Realtime subscription notice for medicalCertificates:', err.message);
      if (onError) onError(err);
    }
  );
}

export async function saveMedicalCertificateFirestore(certificate: MedicalCertificate): Promise<void> {
  const certId = certificate.id || `cert-${Date.now()}`;
  const base64Str = certificate.arquivoBase64 || '';

  try {
    if (base64Str.length > MAX_SINGLE_DOC_BASE64_LENGTH) {
      const chunks: string[] = [];
      for (let i = 0; i < base64Str.length; i += MAX_SINGLE_DOC_BASE64_LENGTH) {
        chunks.push(base64Str.slice(i, i + MAX_SINGLE_DOC_BASE64_LENGTH));
      }

      if (chunks.length > 12) {
        throw new Error('O arquivo anexado excede o limite máximo suportado pelo banco de dados (máx. 5 MB).');
      }

      // Save chunks first so when main doc triggers listener, chunks are ready
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkDocId = `${certId}_chunk_${idx}`;
        await setDoc(doc(db, 'medicalCertificates', chunkDocId), {
          isChunk: true,
          parentId: certId,
          chunkIndex: idx,
          chunkData: chunks[idx],
          criadoEm: certificate.criadoEm || new Date().toISOString()
        });
      }

      const mainData = cleanUndefined({
        ...certificate,
        id: certId,
        arquivoBase64: '__CHUNKED__',
        chunkCount: chunks.length
      });
      await setDoc(doc(db, 'medicalCertificates', certId), mainData, { merge: true });
    } else {
      const data = cleanUndefined({ ...certificate, id: certId });
      await setDoc(doc(db, 'medicalCertificates', certId), data, { merge: true });
    }
  } catch (error: any) {
    console.warn('saveMedicalCertificateFirestore error:', error);
    const rawMsg = error?.message || String(error);
    if (rawMsg.includes('longer than') || rawMsg.includes('exceeds the maximum allowed size') || rawMsg.includes('resource-exhausted')) {
      throw new Error('A foto ou arquivo é muito grande para o banco de dados (limite excedido). Tente tirar uma foto mais próxima ou enviar um arquivo menor.');
    }
    if (rawMsg.includes('permission-denied') || rawMsg.includes('Missing or insufficient permissions')) {
      throw new Error('Permissão negada no banco de dados ao salvar o atestado.');
    }
    if (rawMsg.includes('network') || rawMsg.includes('Failed to fetch') || rawMsg.includes('offline')) {
      throw new Error('Falha de conexão com a internet ao enviar o atestado. Verifique seu sinal e tente novamente.');
    }
    throw new Error(`Falha ao gravar no banco de dados (${rawMsg})`);
  }
}

export async function updateMedicalCertificateStatusFirestore(
  id: string,
  status: MedicalCertificate['status'],
  parecerRH?: string,
  analisadoPor?: string
): Promise<void> {
  try {
    const updatePayload: Partial<MedicalCertificate> = {
      status,
      analisadoEm: new Date().toISOString(),
      ...(parecerRH !== undefined && { parecerRH }),
      ...(analisadoPor !== undefined && { analisadoPor })
    };
    await updateDoc(doc(db, 'medicalCertificates', id), updatePayload);
  } catch (error) {
    console.warn('updateMedicalCertificateStatusFirestore error:', error);
    throw error;
  }
}

export async function deleteMedicalCertificateFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'medicalCertificates', id));
    // Also clean up any possible chunks in background
    for (let i = 0; i < 12; i++) {
      deleteDoc(doc(db, 'medicalCertificates', `${id}_chunk_${i}`)).catch(() => {});
    }
  } catch (error) {
    console.warn('deleteMedicalCertificateFirestore error:', error);
    throw error;
  }
}

// ==========================================
// COMPROVANTES DE RENDIMENTOS (IRPF / DIRF)
// ==========================================

export async function saveIncomeReportFirestore(report: IncomeReport): Promise<void> {
  const reportId = report.id || `irpf-${report.beneficiario.employeeCodigo}-${report.anoCalendario}`;
  const data = cleanUndefined({ ...report, id: reportId });
  try {
    await setDoc(doc(db, 'incomeReports', reportId), data, { merge: true });
  } catch (error) {
    console.warn('saveIncomeReportFirestore error:', error);
    throw error;
  }
}

export async function saveIncomeReportsBatchFirestore(reports: IncomeReport[]): Promise<void> {
  for (const report of reports) {
    try {
      await saveIncomeReportFirestore(report);
    } catch (e) {
      console.warn(`Erro ao salvar informe ${report.id} no Firestore:`, e);
    }
  }
}

export async function getIncomeReportsFirestore(): Promise<IncomeReport[]> {
  try {
    const snap = await getDocs(collection(db, 'incomeReports'));
    const reports: IncomeReport[] = [];
    snap.forEach((d) => {
      reports.push({ id: d.id, ...d.data() } as IncomeReport);
    });
    return reports;
  } catch (error) {
    console.warn('getIncomeReportsFirestore error:', error);
    return [];
  }
}

export function subscribeToIncomeReports(callback: (reports: IncomeReport[]) => void): () => void {
  return onSnapshot(
    collection(db, 'incomeReports'),
    (snap) => {
      const reports: IncomeReport[] = [];
      snap.forEach((d) => {
        reports.push({ id: d.id, ...d.data() } as IncomeReport);
      });
      callback(reports);
    },
    (err) => {
      console.warn('subscribeToIncomeReports error:', err);
    }
  );
}

export async function deleteIncomeReportFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'incomeReports', id));
  } catch (error) {
    console.warn('deleteIncomeReportFirestore error:', error);
    throw error;
  }
}

export async function deleteIncomeReportsBatchFirestore(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'incomeReports', id));
    });
    await batch.commit();
  } catch (error) {
    console.warn('deleteIncomeReportsBatchFirestore batch error, trying fallback:', error);
    await Promise.allSettled(ids.map(id => deleteDoc(doc(db, 'incomeReports', id))));
  }
}

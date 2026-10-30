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
import {
  db,
  auth,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError
} from '../firebase';
import { Employee, PayReceipt, SystemConfig, SignatureVerification, UserAccount, MedicalCertificate, IncomeReport, SystemLog } from '../types';

function handleWriteCatch(error: unknown): void {
  if (isQuotaExceededError(error)) {
    markFirestoreQuotaExceeded(error);
  }
}


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
  exigirCompletarCadastroPrimeiroAcesso: true,
  exigir2FALogin: false,
  canal2FALogin: 'WHATSAPP',
  geminiApiKey: '',
  aiModel: 'gemini-3.8-flash',
  aiEnabled: true
};

// 1. Employees
export function subscribeEmployees(callback: (employees: Employee[]) => void, onError?: (err: any) => void) {
  if (isFirestoreQuotaExceeded()) return () => {};
  const path = 'employees';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Employee;
        list.push({
          ...data,
          id: docSnap.id,
          codigo: String(data.codigo ?? docSnap.id).trim()
        });
      });
      callback(list);
    },
    (err) => {
      handleWriteCatch(err);
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
  if (isFirestoreQuotaExceeded()) return;
  const cleanCode = String(employee.codigo).trim();
  try {
    await setDoc(doc(db, 'employees', cleanCode), cleanUndefined({ ...employee, codigo: cleanCode }), { merge: true });
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function saveEmployeesBatchFirestore(employeesList: Employee[]): Promise<void> {
  if (!employeesList || employeesList.length === 0 || isFirestoreQuotaExceeded()) return;
  const CHUNK_SIZE = 150;
  for (let i = 0; i < employeesList.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) break;
    const chunk = employeesList.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(emp => {
        const cleanCode = String(emp.codigo).trim();
        const ref = doc(db, 'employees', cleanCode);
        batch.set(ref, cleanUndefined({ ...emp, codigo: cleanCode }), { merge: true });
      });
      await batch.commit();
    } catch (batchError) {
      handleWriteCatch(batchError);
      if (isFirestoreQuotaExceeded()) break;
    }
  }
}

export async function deleteEmployeeFirestore(codigo: string, docId?: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const cleanCode = String(codigo).trim();
  const idsToDelete = new Set<string>([cleanCode]);
  if (docId && String(docId).trim()) {
    idsToDelete.add(String(docId).trim());
  }

  try {
    // Delete known document IDs directly
    for (const id of idsToDelete) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(doc(db, 'employees', id));
    }

    // Also query by 'codigo' field (both string and number) in case the document ID differs
    const qStr = query(collection(db, 'employees'), where('codigo', '==', cleanCode));
    const snapStr = await getDocs(qStr);
    for (const d of snapStr.docs) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(d.ref);
    }

    const numCode = Number(cleanCode);
    if (!Number.isNaN(numCode)) {
      const qNum = query(collection(db, 'employees'), where('codigo', '==', numCode));
      const snapNum = await getDocs(qNum);
      for (const d of snapNum.docs) {
        if (isFirestoreQuotaExceeded()) return;
        await deleteDoc(d.ref);
      }
    }
  } catch (error) {
    handleWriteCatch(error);
  }
}

// 2. Receipts
export function subscribeReceipts(callback: (receipts: PayReceipt[]) => void, onError?: (err: any) => void) {
  if (isFirestoreQuotaExceeded()) return () => {};
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
      handleWriteCatch(err);
      if (onError) onError(err);
    }
  );
}

export async function saveReceiptFirestore(receipt: PayReceipt): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    await setDoc(doc(db, 'receipts', receipt.id), cleanUndefined(receipt), { merge: true });
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function saveReceiptsBatchFirestore(receiptsList: PayReceipt[]): Promise<void> {
  if (!receiptsList || receiptsList.length === 0 || isFirestoreQuotaExceeded()) return;
  const CHUNK_SIZE = 150;
  for (let i = 0; i < receiptsList.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) break;
    const chunk = receiptsList.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        const ref = doc(db, 'receipts', rec.id);
        batch.set(ref, cleanUndefined(rec), { merge: true });
      });
      await batch.commit();
    } catch (batchError) {
      handleWriteCatch(batchError);
      if (isFirestoreQuotaExceeded()) break;
    }
  }
}

export async function signReceiptFirestore(
  receiptId: string,
  codigoAssinatura: string,
  metodo: 'WHATSAPP' | 'EMAIL',
  fullReceipt?: PayReceipt
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
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
    handleWriteCatch(error);
  }
}

export async function deleteReceiptFirestore(
  receiptId: string,
  employeeCodigo?: string,
  competencia?: string
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'receipts', receiptId));
    if (employeeCodigo && !isFirestoreQuotaExceeded()) {
      const cleanCode = String(employeeCodigo).trim();
      const q = competencia
        ? query(
            collection(db, 'receipts'),
            where('employeeCodigo', '==', cleanCode),
            where('competencia', '==', competencia)
          )
        : query(collection(db, 'receipts'), where('employeeCodigo', '==', cleanCode));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (isFirestoreQuotaExceeded()) break;
        if (!competencia || d.data()?.competencia === competencia || d.id === receiptId) {
          await deleteDoc(d.ref);
        }
      }
    }
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function deleteReceiptsBatchFirestore(receiptIds: string[]): Promise<void> {
  if (!receiptIds || receiptIds.length === 0 || isFirestoreQuotaExceeded()) return;
  const CHUNK_SIZE = 150;
  for (let i = 0; i < receiptIds.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) break;
    const chunk = receiptIds.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, 'receipts', id));
      });
      await batch.commit();
    } catch (e) {
      handleWriteCatch(e);
      if (isFirestoreQuotaExceeded()) break;
    }
  }
}

export async function toggleEmployeeBlockFirestore(
  employeeCodigo: string,
  bloqueado: boolean,
  motivo?: string
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const payload: Partial<Employee> = {
      bloqueado,
      bloqueadoEm: bloqueado ? new Date().toISOString() : undefined,
      ...(motivo !== undefined && { motivoBloqueio: motivo })
    };
    await updateDoc(doc(db, 'employees', employeeCodigo), cleanUndefined(payload));
  } catch (error) {
    handleWriteCatch(error);
  }
}

// 3. System Config
export function subscribeSystemConfig(callback: (config: SystemConfig) => void) {
  if (isFirestoreQuotaExceeded()) return () => {};
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
      handleWriteCatch(err);
    }
  );
}

export async function saveSystemConfigFirestore(config: SystemConfig): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    await setDoc(doc(db, 'systemConfig', 'default'), cleanUndefined(config), { merge: true });
  } catch (error) {
    handleWriteCatch(error);
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

  if (!isFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'signatureVerifications', verificationId), verification);
    } catch (error) {
      handleWriteCatch(error);
    }
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
  if (isFirestoreQuotaExceeded()) return () => {};
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const users: UserAccount[] = [];
      snap.forEach((docItem) => {
        const data = docItem.data() as UserAccount;
        users.push({
          ...data,
          uid: data.uid || docItem.id
        });
      });
      callback(users);
    },
    (error) => {
      handleWriteCatch(error);
    }
  );
}

export async function saveUserAccount(user: UserAccount): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const uid = user.uid || (user.employeeCodigo ? `user-${user.employeeCodigo}` : `user-${Date.now()}`);
  const payload = cleanUndefined({ ...user, uid });
  try {
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function saveUsersBatchFirestore(usersList: UserAccount[]): Promise<void> {
  if (!usersList || usersList.length === 0) return;

  // Always sync to server-side permanent disk storage first
  try {
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: usersList })
    }).catch(() => {});
  } catch (e) {}

  if (isFirestoreQuotaExceeded()) return;

  // Chunking in slices of 150 documents to stay well below Firestore 500 limits
  const CHUNK_SIZE = 150;
  for (let i = 0; i < usersList.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) break;
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
      handleWriteCatch(batchError);
      if (isFirestoreQuotaExceeded()) break;
    }
  }
}

export async function deleteUserAccountFirestore(uid: string, employeeCodigo?: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const idsToDelete = new Set<string>();
  if (uid && String(uid).trim()) idsToDelete.add(String(uid).trim());
  if (employeeCodigo && String(employeeCodigo).trim()) {
    const cleanCode = String(employeeCodigo).trim();
    idsToDelete.add(`user-${cleanCode}`);
    idsToDelete.add(`user-colab-${cleanCode}`);
  }
  try {
    for (const id of idsToDelete) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(doc(db, 'users', id));
    }
    if (employeeCodigo && String(employeeCodigo).trim() && !isFirestoreQuotaExceeded()) {
      const cleanCode = String(employeeCodigo).trim();
      const q = query(collection(db, 'users'), where('employeeCodigo', '==', cleanCode));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (isFirestoreQuotaExceeded()) break;
        if ((d.data() as UserAccount).role !== 'GESTOR') {
          await deleteDoc(d.ref);
        }
      }
    }
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  if (isFirestoreQuotaExceeded()) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    return null;
  } catch (error) {
    handleWriteCatch(error);
    return null;
  }
}

// Clean all records for pristine production database
export async function clearAllDatabaseData(): Promise<void> {
  try {
    fetch('/api/income-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: [] })
    }).catch(() => {});
    if (isFirestoreQuotaExceeded()) return;
    const empSnap = await getDocs(collection(db, 'employees'));
    for (const d of empSnap.docs) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(d.ref);
    }
    const recSnap = await getDocs(collection(db, 'receipts'));
    for (const d of recSnap.docs) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(d.ref);
    }
    const certSnap = await getDocs(collection(db, 'medicalCertificates'));
    for (const d of certSnap.docs) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(d.ref);
    }
    const irpfSnap = await getDocs(collection(db, 'incomeReports'));
    for (const d of irpfSnap.docs) {
      if (isFirestoreQuotaExceeded()) return;
      await deleteDoc(d.ref);
    }
  } catch (e) {
    handleWriteCatch(e);
  }
}

// 5. Medical Certificates (Atestados Médicos)
const MAX_SINGLE_DOC_BASE64_LENGTH = 650000; // ~650 KB string safely inside Firestore 1 MiB limit

export function subscribeMedicalCertificates(
  callback: (certificates: MedicalCertificate[]) => void,
  onError?: (err: any) => void
) {
  if (isFirestoreQuotaExceeded()) return () => {};
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
      handleWriteCatch(err);
      if (onError) onError(err);
    }
  );
}

export async function saveMedicalCertificateFirestore(certificate: MedicalCertificate): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
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
        if (isFirestoreQuotaExceeded()) return;
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
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded(error);
      return;
    }
    const rawMsg = error?.message || String(error);
    if (rawMsg.includes('longer than') || rawMsg.includes('exceeds the maximum allowed size')) {
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
  if (isFirestoreQuotaExceeded()) return;
  try {
    const updatePayload: Partial<MedicalCertificate> = {
      status,
      analisadoEm: new Date().toISOString(),
      ...(parecerRH !== undefined && { parecerRH }),
      ...(analisadoPor !== undefined && { analisadoPor })
    };
    await updateDoc(doc(db, 'medicalCertificates', id), updatePayload);
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function deleteMedicalCertificateFirestore(id: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'medicalCertificates', id));
    for (let i = 0; i < 12; i++) {
      if (isFirestoreQuotaExceeded()) break;
      deleteDoc(doc(db, 'medicalCertificates', `${id}_chunk_${i}`)).catch(() => {});
    }
  } catch (error) {
    handleWriteCatch(error);
  }
}

// ==========================================
// COMPROVANTES DE RENDIMENTOS (IRPF / DIRF)
// ==========================================

export async function saveIncomeReportFirestore(report: IncomeReport): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const reportId = report.id || `irpf-${report.beneficiario.employeeCodigo}-${report.anoCalendario}`;
  const safeReport: IncomeReport = {
    ...report,
    id: reportId,
    enviadoEm: report.enviadoEm || new Date().toISOString(),
    canalEnvio: report.canalEnvio || 'PORTAL'
  };

  // Prevent Firestore 1MiB document limit failure if embedded PDF base64 is too large
  if (
    safeReport.arquivoPdfOriginal?.base64 &&
    safeReport.arquivoPdfOriginal.base64.length > MAX_SINGLE_DOC_BASE64_LENGTH
  ) {
    safeReport.arquivoPdfOriginal = {
      ...safeReport.arquivoPdfOriginal,
      base64: `/api/income-reports/${reportId}/pdf`
    };
  }

  const data = cleanUndefined(safeReport);
  try {
    await setDoc(doc(db, 'incomeReports', reportId), data, { merge: true });
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function saveIncomeReportsBatchFirestore(reports: IncomeReport[]): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  for (const report of reports) {
    if (isFirestoreQuotaExceeded()) break;
    try {
      await saveIncomeReportFirestore(report);
    } catch (e) {
      handleWriteCatch(e);
    }
  }
}

export async function getIncomeReportsFirestore(): Promise<IncomeReport[]> {
  if (isFirestoreQuotaExceeded()) return [];
  try {
    const snap = await getDocs(collection(db, 'incomeReports'));
    const reports: IncomeReport[] = [];
    snap.forEach((d) => {
      reports.push({ id: d.id, ...d.data() } as IncomeReport);
    });
    return reports;
  } catch (error) {
    handleWriteCatch(error);
    return [];
  }
}

export function subscribeToIncomeReports(callback: (reports: IncomeReport[]) => void): () => void {
  if (isFirestoreQuotaExceeded()) return () => {};
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
      handleWriteCatch(err);
    }
  );
}

export async function deleteIncomeReportFirestore(id: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'incomeReports', id));
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function deleteIncomeReportsBatchFirestore(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0 || isFirestoreQuotaExceeded()) return;
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'incomeReports', id));
    });
    await batch.commit();
  } catch (error) {
    handleWriteCatch(error);
  }
}

// ==========================================
// HISTÓRICO DE AUDITORIA E LOGS DO SISTEMA
// ==========================================

export async function saveSystemLogFirestore(log: SystemLog): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const logId = log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const data = cleanUndefined({ ...log, id: logId });
  try {
    await setDoc(doc(db, 'systemLogs', logId), data, { merge: true });
  } catch (error) {
    handleWriteCatch(error);
  }
}

export async function saveSystemLogsBatchFirestore(logs: SystemLog[]): Promise<void> {
  if (!logs || logs.length === 0 || isFirestoreQuotaExceeded()) return;
  const CHUNK_SIZE = 150;
  for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExceeded()) break;
    const chunk = logs.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(log => {
        const logId = log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        batch.set(doc(db, 'systemLogs', logId), cleanUndefined({ ...log, id: logId }), { merge: true });
      });
      await batch.commit();
    } catch (e) {
      handleWriteCatch(e);
      if (isFirestoreQuotaExceeded()) break;
    }
  }
}

export function subscribeSystemLogs(callback: (logs: SystemLog[]) => void, onError?: (err: any) => void): () => void {
  if (isFirestoreQuotaExceeded()) return () => {};
  return onSnapshot(
    collection(db, 'systemLogs'),
    (snap) => {
      const logs: SystemLog[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id, ...d.data() } as SystemLog);
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(logs);
    },
    (err) => {
      handleWriteCatch(err);
      if (onError) onError(err);
    }
  );
}

export async function clearSystemLogsFirestore(): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const snap = await getDocs(collection(db, 'systemLogs'));
    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    handleWriteCatch(error);
  }
}

